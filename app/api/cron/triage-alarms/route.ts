// app/api/cron/triage-alarms/route.ts
//
// Vercel Cron — runs every 2 minutes
// Picks up alarms where triage_status IS NULL and calls the AI triage engine.
//
// Add to vercel.json:
//   { "path": "/api/cron/triage-alarms", "schedule": "*/2 * * * *" }
//
// Processes up to 20 alarms per run (batch size keeps execution under 60s).
// P1 alarms are processed first (urgent), then P2, then P3.
// Alarms older than 24h are skipped — too stale for meaningful auto-triage.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load untriaged alarms — prioritize P1/P2, skip stale alarms (>24h)
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: alarms, error } = await supabase
    .from('alarms')
    .select('id, priority, event_type, status')
    .is('triage_status', null)
    .eq('status', 'pending')
    .gte('created_at', since)
    .order('priority', { ascending: true })  // P1 first
    .order('created_at', { ascending: true }) // oldest first within priority
    .limit(20);

  if (error || !alarms?.length) {
    return NextResponse.json({ triaged: 0, message: 'No untriaged alarms' });
  }

  console.log(`[cron/triage-alarms] Processing ${alarms.length} untriaged alarms`);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ggsoc.com';
  let triaged = 0;
  let failed  = 0;

  // Process in sequence (not parallel) to avoid overloading the AI API
  for (const alarm of alarms) {
    try {
      const res = await fetch(`${APP_URL}/api/ai/triage`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ alarmId: alarm.id }),
      });

      if (res.ok) {
        triaged++;
        const result = await res.json();
        console.log(`[cron/triage-alarms] ${alarm.id} → ${result.decision} (${result.confidence}%)`);
      } else {
        failed++;
        const err = await res.text();
        console.error(`[cron/triage-alarms] Failed ${alarm.id}: ${err.slice(0, 200)}`);
      }

    } catch (err: any) {
      failed++;
      console.error(`[cron/triage-alarms] Exception for ${alarm.id}:`, err.message);
    }
  }

  console.log(`[cron/triage-alarms] Done: ${triaged} triaged, ${failed} failed`);
  return NextResponse.json({ triaged, failed, total: alarms.length });
}
