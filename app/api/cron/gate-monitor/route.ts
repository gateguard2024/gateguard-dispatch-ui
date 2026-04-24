// app/api/cron/gate-monitor/route.ts
//
// Vercel Cron — runs every 5 minutes
// Checks for gate/door alarms that have been open (unresolved) for 5+ minutes
// and escalates them to P1 with a "Gate Stuck Open" alert if not already handled.
//
// Add to vercel.json:
//   { "path": "/api/cron/gate-monitor", "schedule": "*/5 * * * *" }
//
// Gate event types we monitor:
//   een.objectIntrusionEvent.v1  — object in region (often gates/barriers)
//   een.personTailgateEvent.v1   — tailgate through gate
//
// Custom gate-open detection uses site_name pattern matching as a fallback
// until cameras are tagged with gate/door metadata.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GATE_EVENT_TYPES = new Set([
  'een.objectIntrusionEvent.v1',
  'een.personTailgateEvent.v1',
]);

// Keywords in event_label that suggest a gate/door is involved
const GATE_KEYWORDS = ['gate', 'door', 'entry', 'exit', 'access', 'barrier'];

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now        = new Date();
  const cutoffTime = new Date(now.getTime() - FIVE_MINUTES_MS).toISOString();

  // Find pending alarms older than 5 minutes that may be gate-related
  const { data: staleAlarms } = await supabase
    .from('alarms')
    .select('id, priority, event_type, event_label, site_name, zone_id, account_id, created_at, triage_status')
    .eq('status', 'pending')
    .lt('created_at', cutoffTime)  // older than 5 minutes
    .neq('priority', 'P1');        // P1 already escalated

  if (!staleAlarms?.length) {
    return NextResponse.json({ checked: 0, escalated: 0 });
  }

  let escalated = 0;

  for (const alarm of staleAlarms) {
    const isGateEvent = GATE_EVENT_TYPES.has(alarm.event_type);
    const labelLower  = (alarm.event_label ?? '').toLowerCase();
    const hasGateKeyword = GATE_KEYWORDS.some(kw => labelLower.includes(kw));

    if (!isGateEvent && !hasGateKeyword) continue;

    const minutesOpen = Math.round((now.getTime() - new Date(alarm.created_at).getTime()) / 60_000);

    // Escalate to P1 with gate-stuck-open interpretation
    const { error } = await supabase
      .from('alarms')
      .update({
        priority:       'P1',
        triage_status:  'escalated',
        triage_result:  {
          decision:        'escalate',
          priority:        'P1',
          interpretation:  `Gate or access point has been open/triggered for ${minutesOpen} minutes with no operator response. Possible stuck gate, unauthorized access, or system fault.`,
          suggested_steps: [
            'View live camera feed at the gate location immediately',
            'Check if gate is physically stuck open or being held',
            'Attempt remote gate close if Brivo access is available',
            'Contact on-site security or property manager',
            'If unauthorized access confirmed, consider dispatching security',
          ],
          confidence:   90,
          reasoning:    `Gate event unresolved for ${minutesOpen} minutes — auto-escalated by GateGuard monitor.`,
          model:        'rule-based-gate-monitor',
          processed_at: now.toISOString(),
        },
      })
      .eq('id', alarm.id);

    if (!error) {
      escalated++;
      console.log(`[gate-monitor] ⚠ Escalated gate alarm ${alarm.id} at ${alarm.site_name} — open ${minutesOpen}min`);
    }
  }

  console.log(`[gate-monitor] Checked ${staleAlarms.length} stale alarms, escalated ${escalated} gate events`);
  return NextResponse.json({ checked: staleAlarms.length, escalated });
}
