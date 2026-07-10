// app/api/ai/triage/route.ts
//
// GateGuard AI Triage Engine — powered by Claude
//
// Analyzes a single alarm and determines:
//   auto_dismiss   → AI resolves it, writes incident report, operator never sees it
//   route_to_human → Goes to operator queue with AI pre-assessment attached
//   escalate       → Upgraded to P1, operator sees urgent AI flag
//
// P1 alarms (gun, fire, fight, etc.) are ALWAYS routed to human immediately —
// AI provides context but never auto-dismisses a P1.
//
// Called by: POST /api/ai/triage  { alarmId: string }
// Also called by: /api/cron/triage-alarms (batch processor)
//
// Protocol guide (per site context + time of day):
//   Motion only, in-schedule          → auto_dismiss (normal activity)
//   Motion only, after-hours          → route_to_human (P3)
//   Person detected, in-schedule      → auto_dismiss (likely resident/staff)
//   Person detected, after-hours      → route_to_human (P2)
//   Loitering 5+ min                  → route_to_human (possible theft)
//   Intrusion after-hours             → route_to_human / escalate (P1)
//   Gate stuck open                   → auto_dismiss + notification note
//   Dumping / oversized items         → auto_dismiss + incident report
//   Vehicle detected, normal hours    → auto_dismiss
//   Vehicle detected, after-hours     → route_to_human
//   Fight / struggle / hands up       → escalate (P1, never auto)
//   Gun / weapon detected             → escalate (P1, never auto)
//   Fire detected                     → escalate (P1, never auto)
//   Car crash                         → escalate (P1, never auto)
//   LPR read                          → auto_dismiss (log only)
//   Face detected                     → auto_dismiss (informational)

import { NextResponse } from 'next/server';
import { createClient }  from '@supabase/supabase-js';
import Anthropic         from '@anthropic-ai/sdk';

// ─── Types ────────────────────────────────────────────────────────────────────
type Decision = 'auto_dismiss' | 'route_to_human' | 'escalate';

interface TriageResult {
  decision:        Decision;
  priority:        'P1' | 'P2' | 'P3' | 'P4';
  interpretation:  string;
  suggested_steps: string[];
  confidence:      number;
  reasoning:       string;
  model:           string;
  processed_at:    string;
}

// ─── P1 event types — NEVER auto-dismiss, always go to human ─────────────────
const ALWAYS_HUMAN = new Set([
  'een.gunDetectionEvent.v1',
  'een.gunShotAudioDetectionEvent.v1',
  'een.handsUpDetectionEvent.v1',
  'een.fightDetectionEvent.v1',
  'een.violenceDetectionEvent.v1',
  'een.panicButtonEvent.v1',
  'een.fireDetectionEvent.v1',
  'een.personTailgateEvent.v1',
]);

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { alarmId } = await request.json();
    if (!alarmId) {
      return NextResponse.json({ error: 'alarmId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── 1. Load alarm with zone + camera context ──────────────────────────────
    const { data: alarm, error: alarmErr } = await supabase
      .from('alarms')
      .select(`
        id, priority, event_type, event_label, site_name, status,
        created_at, triage_status,
        zones (
          id, name, timezone, monitoring_start, monitoring_end,
          is_monitored, weekly_schedule, site_info
        ),
        cameras (
          id, name, een_camera_id
        )
      `)
      .eq('id', alarmId)
      .single();

    if (alarmErr || !alarm) {
      return NextResponse.json({ error: 'Alarm not found' }, { status: 404 });
    }

    // Skip if already triaged
    if (alarm.triage_status !== null) {
      return NextResponse.json({ skipped: true, reason: 'already triaged' });
    }

    // Mark as processing to prevent duplicate triage
    await supabase
      .from('alarms')
      .update({ triage_status: 'processing' })
      .eq('id', alarmId);

    // ── 2. P1 events — skip AI, route directly to human ──────────────────────
    if (alarm.priority === 'P1' || ALWAYS_HUMAN.has(alarm.event_type)) {
      await supabase
        .from('alarms')
        .update({
          triage_status: 'skipped',
          triage_result: {
            decision:        'route_to_human',
            priority:        alarm.priority,
            interpretation:  `${alarm.event_label} detected — P1 events are always routed to an operator immediately.`,
            suggested_steps: [
              'Review live camera feed immediately',
              'Assess threat level visually',
              'Contact site emergency contacts if threat confirmed',
              'Consider dispatching emergency services if required',
            ],
            confidence:   100,
            reasoning:    'P1 priority — auto-triage bypassed, routed directly to human queue.',
            model:        'rule-based',
            processed_at: new Date().toISOString(),
          },
          triaged_at: new Date().toISOString(),
        })
        .eq('id', alarmId);

      return NextResponse.json({ decision: 'route_to_human', method: 'p1-bypass' });
    }

    // ── 3. Load recent alarm history for this zone ────────────────────────────
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const zone = alarm.zones as any;
    const zoneId = zone?.id;

    const { data: recentAlarms } = zoneId ? await supabase
      .from('alarms')
      .select('event_type, status, priority, created_at')
      .eq('zone_id', zoneId)
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(20) : { data: [] };

    const recentCount = recentAlarms?.length ?? 0;
    const recentAutoResolved = (recentAlarms ?? []).filter(a => a.status === 'resolved').length;

    // ── 4. Determine if alarm is in/out of monitoring schedule ────────────────
    const alarmTime   = new Date(alarm.created_at);
    const timezone    = zone?.timezone ?? 'America/New_York';
    const localHour   = new Date(alarmTime.toLocaleString('en-US', { timeZone: timezone })).getHours();
    const monStart    = zone?.monitoring_start ? parseInt(zone.monitoring_start.split(':')[0]) : 18;
    const monEnd      = zone?.monitoring_end   ? parseInt(zone.monitoring_end.split(':')[0])   : 6;

    // Handles overnight windows (e.g. 18:00 → 06:00)
    const isAfterHours = monStart > monEnd
      ? localHour >= monStart || localHour < monEnd
      : localHour >= monStart && localHour < monEnd;

    // ── 5. Build Claude prompt ────────────────────────────────────────────────
    const siteInfo    = zone?.site_info ?? {};
    const cameraName  = (alarm.cameras as any)?.name ?? 'Unknown Camera';

    const systemPrompt = `You are an AI security analyst for GateGuard, a professional SOC platform.
Your job is to analyze security camera alarms and determine the appropriate response.

You must return ONLY valid JSON — no prose, no markdown, no code blocks. Exactly this schema:
{
  "decision": "auto_dismiss" | "route_to_human" | "escalate",
  "priority": "P1" | "P2" | "P3" | "P4",
  "interpretation": "string — 1-2 sentences describing what likely happened",
  "suggested_steps": ["string", "string", "string"],
  "confidence": 0-100,
  "reasoning": "string — brief explanation of your decision"
}

Decision guide:
- auto_dismiss: Alarm is very likely a false alarm or routine authorized activity. No human action needed. Write a brief incident note.
- route_to_human: Alarm needs operator review. Not immediately dangerous but requires judgment.
- escalate: Threat is confirmed or high probability. Upgrade to P1 if not already.

Rules:
- NEVER auto_dismiss if the event is after-hours AND involves a person
- NEVER auto_dismiss intrusion, tailgate, or object removal events
- Always escalate fight, gun, fire, violence regardless of priority
- Motion-only events during business hours = almost always auto_dismiss
- Consider the site's expected activity and camera location`;

    const userPrompt = `
Site: ${alarm.site_name ?? 'Unknown'}
Zone: ${zone?.name ?? 'Unknown'}
Camera: ${cameraName}
Event: ${alarm.event_label} (${alarm.event_type})
Current Priority: ${alarm.priority}
Time of alarm: ${alarmTime.toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })} local time
Monitoring schedule: ${monStart}:00 – ${monEnd}:00 (${isAfterHours ? '⚠️ CURRENTLY IN MONITORED HOURS — after-hours alert' : 'outside monitoring window — business hours'})

Site context:
- Expected activity: ${siteInfo.expected_activity || 'Not specified'}
- Guard on site: ${siteInfo.guard_on_site ? 'Yes' : 'No'}
- Special notes: ${siteInfo.special_notes || 'None'}

Recent 24h activity for this zone:
- Total alarms: ${recentCount}
- Already resolved: ${recentAutoResolved}
${recentCount > 10 ? '- ⚠️ High alarm volume today — possible sensor issue or unusual activity' : ''}

Analyze this alarm and return your JSON decision.`.trim();

    // ── 6. Call Claude ────────────────────────────────────────────────────────
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const modelId   = 'claude-haiku-4-5-20251001'; // Fast model for high-volume triage

    const message = await client.messages.create({
      model:      modelId,
      max_tokens: 512,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(`Claude returned no valid JSON: ${rawText.slice(0, 200)}`);
    }

    const result = JSON.parse(jsonMatch[0]) as Omit<TriageResult, 'model' | 'processed_at'>;

    const triageResult: TriageResult = {
      ...result,
      model:        modelId,
      processed_at: new Date().toISOString(),
    };

    // ── 7. Apply decision ─────────────────────────────────────────────────────
    const decision   = triageResult.decision;
    const newStatus  = decision === 'auto_dismiss' ? 'resolved' : 'pending';
    const newPriority = decision === 'escalate' ? 'P1' : (triageResult.priority ?? alarm.priority);

    const triageStatus = decision === 'auto_dismiss'   ? 'auto_dismissed'
                       : decision === 'escalate'       ? 'escalated'
                       : 'route_to_human';

    await supabase
      .from('alarms')
      .update({
        status:         newStatus,
        priority:       newPriority,
        triage_status:  triageStatus,
        triage_result:  triageResult,
        triaged_at:     new Date().toISOString(),
      })
      .eq('id', alarmId);

    // ── 8. Auto-dismissed → write incident report ─────────────────────────────
    if (decision === 'auto_dismiss') {
      await supabase
        .from('incident_reports')
        .insert({
          alarm_id:     alarmId,
          zone_id:      zoneId,
          camera_id:    (alarm.cameras as any)?.id ?? null,
          operator_id:  'ai-triage',
          operator_name:'GateGuard AI',
          action_taken: 'false_alarm',
          notes:        `AI auto-dismissed (${triageResult.confidence}% confidence): ${triageResult.interpretation}`,
          report_type:  'ai_auto',
          report_body:  JSON.stringify(triageResult, null, 2),
          generated_at: new Date().toISOString(),
        });

      console.log(`[ai/triage] ✅ Auto-dismissed alarm ${alarmId}: ${triageResult.interpretation}`);
    } else {
      console.log(`[ai/triage] 👤 Routed alarm ${alarmId} to human (${triageStatus}): ${triageResult.interpretation}`);
    }

    return NextResponse.json({
      alarmId,
      decision,
      priority:       newPriority,
      interpretation: triageResult.interpretation,
      confidence:     triageResult.confidence,
    });

  } catch (err: any) {
    console.error('[ai/triage] Error:', err.message);

    // On failure, un-mark processing so it can be retried
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { alarmId } = await request.clone().json().catch(() => ({ alarmId: null }));
      if (alarmId) {
        await supabase
          .from('alarms')
          .update({ triage_status: null })
          .eq('id', alarmId)
          .eq('triage_status', 'processing');
      }
    } catch (_) {}

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
