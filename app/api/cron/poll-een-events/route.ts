// app/api/cron/poll-een-events/route.ts
//
// Vercel Cron Job — polls EEN for new camera events every 60 seconds
// and writes them into the `alarms` table for the Dispatch Station.
//
// Configure in vercel.json:
//   { "crons": [{ "path": "/api/cron/poll-een-events", "schedule": "* * * * *" }] }
//
// Secured with CRON_SECRET env var — Vercel sets Authorization header automatically.
//
// Flow per account:
//   1. Load all SOC-enabled accounts from Supabase
//   2. GET /api/v3.0/events for each account (last 90 seconds window to avoid gaps)
//   3. Skip event types we don't care about (device status, etc.)
//   4. Upsert into `alarms` table — idempotent on een_event_id to prevent duplicates

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidEENToken } from '@/lib/een';

// ─── Priority + label maps (matches webhook receiver) ────────────────────────
type Priority = 'P1' | 'P2' | 'P3' | 'P4';

const PRIORITY_MAP: Record<string, Priority> = {
  // P1 — Active threats
  'een.gunDetectionEvent.v1':             'P1',
  'een.gunShotAudioDetectionEvent.v1':    'P1',
  'een.handsUpDetectionEvent.v1':         'P1',
  'een.fightDetectionEvent.v1':           'P1',
  'een.violenceDetectionEvent.v1':        'P1',
  'een.panicButtonEvent.v1':              'P1',
  'een.tamperDetectionEvent.v1':          'P1',
  'een.objectIntrusionEvent.v1':          'P1',
  'een.personTailgateEvent.v1':           'P1',
  'een.fireDetectionEvent.v1':            'P1',
  // P2 — Persons / vehicles / security
  'een.personDetectionEvent.v1':          'P2',
  'een.vehicleDetectionEvent.v1':         'P2',
  'een.loiterDetectionEvent.v1':          'P2',
  'een.objectLineCrossEvent.v1':          'P2',
  'een.faceDetectionEvent.v1':            'P2',
  'een.animalDetectionEvent.v1':          'P2',
  'een.fallDetectionEvent.v1':            'P2',
  'een.lprPlateReadEvent.v1':             'P2',
  'een.objectRemovalEvent.v1':            'P2',
  'een.crowdFormationDetectionEvent.v1':  'P2',
  // P3 — General motion
  'een.motionDetectionEvent.v1':          'P3',
  'een.motionInRegionDetectionEvent.v1':  'P3',
};

const LABEL_MAP: Record<string, string> = {
  'een.gunDetectionEvent.v1':             'Gun Detected',
  'een.gunShotAudioDetectionEvent.v1':    'Gunshot Audio Detected',
  'een.handsUpDetectionEvent.v1':         'Hands Up Detected',
  'een.fightDetectionEvent.v1':           'Fight Detected',
  'een.violenceDetectionEvent.v1':        'Violence Detected',
  'een.panicButtonEvent.v1':              'Panic Button Triggered',
  'een.tamperDetectionEvent.v1':          'Camera Tampered',
  'een.objectIntrusionEvent.v1':          'Intrusion Detected',
  'een.personTailgateEvent.v1':           'Tailgate Detected',
  'een.fireDetectionEvent.v1':            'Fire Detected',
  'een.personDetectionEvent.v1':          'Person Detected',
  'een.vehicleDetectionEvent.v1':         'Vehicle Detected',
  'een.loiterDetectionEvent.v1':          'Loitering Detected',
  'een.objectLineCrossEvent.v1':          'Line Crossing Detected',
  'een.faceDetectionEvent.v1':            'Face Detected',
  'een.animalDetectionEvent.v1':          'Animal Detected',
  'een.fallDetectionEvent.v1':            'Fall Detected',
  'een.lprPlateReadEvent.v1':             'License Plate Read',
  'een.objectRemovalEvent.v1':            'Object Removed',
  'een.crowdFormationDetectionEvent.v1':  'Crowd Formation Detected',
  'een.motionDetectionEvent.v1':          'Motion Detected',
  'een.motionInRegionDetectionEvent.v1':  'Motion in Region Detected',
};

const SUBSCRIBED_TYPES = Object.keys(PRIORITY_MAP);

// ─── Handler ──────────────────────────────────────────────────────────────────
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

  // Load all accounts that have EEN tokens (soc_enabled zones)
  const { data: accounts, error: acctErr } = await supabase
    .from('accounts')
    .select('id, name, een_cluster')
    .not('een_access_token', 'is', null);

  if (acctErr || !accounts?.length) {
    return NextResponse.json({ polled: 0, alarms: 0 });
  }

  let totalAlarms = 0;

  // Poll each account in parallel
  await Promise.all(
    accounts.map(async (account) => {
      try {
        const alarmsCreated = await pollAccount(supabase, account.id);
        totalAlarms += alarmsCreated;
      } catch (err: any) {
        console.error(`[poll-een-events] Account ${account.id} error:`, err.message);
      }
    })
  );

  console.log(`[poll-een-events] Polled ${accounts.length} accounts, created ${totalAlarms} alarms`);
  return NextResponse.json({ polled: accounts.length, alarms: totalAlarms });
}

async function pollAccount(supabase: any, accountId: string): Promise<number> {
  const { token, cluster, apiKey } = await getValidEENToken(accountId);
  if (!token || !cluster) return 0;

  // Look back 90 seconds (60s interval + 30s buffer to avoid gaps)
  const now    = new Date();
  const lookback = new Date(now.getTime() - 90 * 1000);
  const startIso = lookback.toISOString().replace(/\.\d{3}Z$/, 'Z'); // strip ms — EEN prefers no ms
  const endIso   = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Fetch cameras for this account so we can map ESN → camera record
  const { data: cameras } = await supabase
    .from('cameras')
    .select('id, name, zone_id, account_id, een_camera_id')
    .eq('account_id', accountId)
    .eq('is_monitored', true);

  if (!cameras?.length) return 0;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        'application/json',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  let alarmsCreated = 0;

  // Poll events per camera (EEN requires actor filter)
  await Promise.all(
    cameras.map(async (cam: any) => {
      if (!cam.een_camera_id) return;

      try {
        const actor = `camera:${cam.een_camera_id}`;

        // Build URL manually — no URLSearchParams (colons in timestamps)
        const eventUrl = [
          `https://${cluster}/api/v3.0/events`,
          `?actor=${encodeURIComponent(actor)}`,
          `&type__in=${SUBSCRIBED_TYPES.map(encodeURIComponent).join('&type__in=')}`,
          `&startTimestamp__gte=${startIso}`,
          `&endTimestamp__lte=${endIso}`,
          `&pageSize=20`,
          `&sort=-startTimestamp`,
        ].join('');

        const res = await fetch(eventUrl, { method: 'GET', headers });
        if (!res.ok) return;

        const data = await res.json();
        const events: any[] = data.results ?? [];

        for (const event of events) {
          const priority = PRIORITY_MAP[event.type] ?? 'P3';
          const label    = LABEL_MAP[event.type]    ?? event.type;

          // Upsert on een_event_id — idempotent across overlapping poll windows
          const { error } = await supabase
            .from('alarms')
            .upsert({
              een_event_id: event.id,        // unique EEN event ID — prevents duplicates
              priority,
              event_type:   event.type,
              event_label:  label,
              site_name:    await getSiteName(supabase, cam.zone_id, accountId),
              camera_id:    cam.id,
              zone_id:      cam.zone_id,
              account_id:   accountId,
              source:       'een',
              status:       'pending',
              created_at:   event.startTimestamp,
            }, { onConflict: 'een_event_id', ignoreDuplicates: true });

          if (!error) alarmsCreated++;
        }
      } catch {}
    })
  );

  return alarmsCreated;
}

// Simple site name cache to avoid repeated DB queries
const siteNameCache = new Map<string, string>();

async function getSiteName(supabase: any, zoneId: string, accountId: string): Promise<string> {
  const key = `${accountId}:${zoneId}`;
  if (siteNameCache.has(key)) return siteNameCache.get(key)!;

  const [{ data: zone }, { data: account }] = await Promise.all([
    supabase.from('zones').select('name').eq('id', zoneId).maybeSingle(),
    supabase.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  const name = [account?.name, zone?.name].filter(Boolean).join(' — ') || 'Unknown Site';
  siteNameCache.set(key, name);
  return name;
}
