// app/api/procedures/suggest/route.ts
//
// AI-powered procedure suggestion engine for GateGuard SOC.
//
// POST body:
//   {
//     zoneId:    string   — required
//     eventType: string   — e.g. "een.vehicleDetectionEvent.v1" (defaults to "default")
//     save:      boolean  — if true, upsert suggestion into procedures table
//   }
//
// Flow:
//   1. Load existing procedure (if any) for this zone + event type
//   2. Load last 50 incident_reports for this zone (action taken + notes)
//   3. Load last 100 alarm counts by event_type for this zone (pattern data)
//   4. Call Claude claude-opus-4-6 to analyze and suggest optimized steps
//   5. Optionally upsert into procedures table if save=true
//   6. Return { suggested, basedOn, existing }
//
// Also supports a hard override: if `steps` and `title` are provided in the body
// along with `save: true`, skip Claude and save those exact steps (manual correction).
//
// Vercel env var required: ANTHROPIC_API_KEY

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ─── Friendly label for event types ──────────────────────────────────────────
function humanizeEventType(type: string): string {
  return type
    .replace(/^een\./, '')
    .replace(/Event\.v\d+$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      zoneId,
      eventType = 'default',
      save      = false,
      steps:    overrideSteps,
      title:    overrideTitle,
    } = body;

    if (!zoneId) {
      return NextResponse.json({ error: 'zoneId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── 1. Load existing procedure ───────────────────────────────────────────
    const { data: existingProc } = await supabase
      .from('procedures')
      .select('*')
      .eq('zone_id', zoneId)
      .or(`event_type.eq.${eventType},event_type.eq.default`)
      .order('event_type', { ascending: false }) // prefer specific over default
      .limit(1)
      .maybeSingle();

    // ── Manual hard correction — skip Claude and save provided steps ─────────
    if (save && overrideSteps?.length > 0) {
      if (existingProc) {
        await supabase
          .from('procedures')
          .update({ title: overrideTitle ?? existingProc.title, steps: overrideSteps })
          .eq('id', existingProc.id);
      } else {
        await supabase
          .from('procedures')
          .insert({
            zone_id:    zoneId,
            event_type: eventType,
            title:      overrideTitle ?? humanizeEventType(eventType) + ' Response',
            steps:      overrideSteps,
          });
      }
      return NextResponse.json({
        suggested: { title: overrideTitle, steps: overrideSteps, reasoning: 'Manually set.' },
        saved: true,
      });
    }

    // ── 2. Load recent incident reports ──────────────────────────────────────
    const { data: reports } = await supabase
      .from('incident_reports')
      .select('action_taken, notes, report_type, generated_at')
      .eq('zone_id', zoneId)
      .order('generated_at', { ascending: false })
      .limit(50);

    // ── 3. Load alarm frequency data ─────────────────────────────────────────
    const { data: recentAlarms } = await supabase
      .from('alarms')
      .select('event_type, status, priority')
      .eq('zone_id', zoneId)
      .order('created_at', { ascending: false })
      .limit(200);

    // Summarize frequency
    const eventFreq: Record<string, number> = {};
    const actionFreq: Record<string, number> = {};
    (recentAlarms ?? []).forEach(a => {
      eventFreq[a.event_type] = (eventFreq[a.event_type] ?? 0) + 1;
    });
    (reports ?? []).forEach(r => {
      if (r.action_taken) {
        actionFreq[r.action_taken] = (actionFreq[r.action_taken] ?? 0) + 1;
      }
    });

    // ── 4. Load zone context ─────────────────────────────────────────────────
    const { data: zone } = await supabase
      .from('zones')
      .select('name, accounts(name)')
      .eq('id', zoneId)
      .maybeSingle();

    const siteName = [
      (zone as any)?.accounts?.name,
      zone?.name,
    ].filter(Boolean).join(' — ');

    // ── 5. Call Claude ───────────────────────────────────────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const systemPrompt = `You are a security operations center (SOC) procedure optimization AI for GateGuard, a remote security monitoring platform. Analyze incident history and generate optimized operator response procedures.

Return ONLY valid JSON with this exact schema:
{
  "title": "string — max 8 words, action-oriented",
  "steps": [
    { "order": 1, "text": "string — max 15 words, specific and actionable" },
    { "order": 2, "text": "..." }
  ],
  "reasoning": "string — 1-2 sentences explaining what patterns informed these steps"
}

Rules:
- 4-7 steps, ordered by urgency
- Start each step with a verb (Verify, Check, Contact, Open, Document...)
- Be specific to the event type and site patterns
- If most incidents resolved as false_alarm, include a quick verification step first
- If police_dispatched was common, include an emergency contact step early`;

    const mostCommonAction = Object.entries(actionFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
    const topEvents = Object.entries(eventFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([t, c]) => `${humanizeEventType(t)}: ${c}x`).join(', ');

    const userPrompt = `
Site: ${siteName}
Event type being responded to: ${humanizeEventType(eventType)} (${eventType})

${existingProc
  ? `Current procedure "${existingProc.title}" (${existingProc.steps?.length ?? 0} steps):\n${(existingProc.steps ?? []).map((s: any) => `  ${s.order}. ${s.text}`).join('\n')}`
  : 'No existing procedure for this event type yet.'
}

Historical data (${reports?.length ?? 0} incidents analyzed):
- Most common event types: ${topEvents || 'insufficient data'}
- Most common operator actions: ${Object.entries(actionFreq).map(([a, c]) => `${a}: ${c}x`).join(', ') || 'none yet'}
- Most frequent resolution: ${mostCommonAction}

Recent operator notes (last 5):
${(reports ?? []).slice(0, 5).map(r =>
  `  - ${r.action_taken ?? 'N/A'}: "${(r.notes ?? '').replace(/\n/g, ' ').slice(0, 120)}"`
).join('\n') || '  (no notes yet)'}

Generate an optimized response procedure for this event type at this site.`.trim();

    const message = await client.messages.create({
      model:      'claude-opus-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON (Claude may wrap it in ```json ... ```)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[procedures/suggest] No JSON in Claude response:', rawText);
      return NextResponse.json({ error: 'Claude returned no valid JSON' }, { status: 500 });
    }

    const suggested = JSON.parse(jsonMatch[0]) as {
      title: string;
      steps: Array<{ order: number; text: string }>;
      reasoning: string;
    };

    // ── 6. Optionally save ───────────────────────────────────────────────────
    if (save && suggested.steps?.length > 0) {
      if (existingProc) {
        await supabase
          .from('procedures')
          .update({ title: suggested.title, steps: suggested.steps })
          .eq('id', existingProc.id);
      } else {
        await supabase
          .from('procedures')
          .insert({
            zone_id:    zoneId,
            event_type: eventType,
            title:      suggested.title,
            steps:      suggested.steps,
          });
      }
    }

    console.log(`[procedures/suggest] Generated ${suggested.steps?.length ?? 0} steps for ${siteName} / ${humanizeEventType(eventType)}`);

    return NextResponse.json({
      suggested,
      basedOn:  reports?.length ?? 0,
      existing: existingProc ?? null,
      saved:    save,
    });

  } catch (err: any) {
    console.error('[procedures/suggest] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
