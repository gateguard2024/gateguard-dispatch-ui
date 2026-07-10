// app/api/webhooks/eagleeye/route.ts
//
// Receives EEN V3 event webhook POSTs and writes them into the `alarms` table.
// EEN fires this URL for each event matching our subscription filters.
//
// EEN event payload shape (same as GET /events response):
//   {
//     id:             string          — unique event ID
//     type:           string          — e.g. "een.motionDetection.v1"
//     actor:          string          — "camera:{esn}"
//     startTimestamp: ISO string
//     endTimestamp:   ISO string | null
//     data?:          object          — schema-specific payload
//   }
//
// EEN may POST a single event object or an array. We handle both.
// We MUST return 200 OK — EEN disables the subscription after 90 days of failures.
//
// Priority mapping (adjust as needed once event types are confirmed via /eventTypes):
//   P1 — intrusion, tamper, loitering, trespass
//   P2 — person, vehicle, object detection
//   P3 — motion
//   P4 — device status / system events

import { NextResponse }               from 'next/server';
import { createClient }               from '@supabase/supabase-js';
import { isCameraWithinMonitoringHours } from '@/lib/schedule';
import { getValidEENToken }           from '@/lib/een';

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'P1' | 'P2' | 'P3' | 'P4';

interface EENEvent {
  id:             string;
  type:           string;
  actor:          string;   // "camera:{esn}" | "user:{id}" | etc.
  startTimestamp: string;
  endTimestamp?:  string | null;
  data?:          Record<string, unknown>;
}

// ─── Priority + label map ─────────────────────────────────────────────────────
// Keys are EEN event type strings. Add new types here as confirmed via /eventTypes.
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

  // P4 — Device / system (skipped in alarm creation)
  'een.deviceCloudStatusUpdateEvent.v1':  'P4',
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
  'een.deviceCloudStatusUpdateEvent.v1':  'Device Status Change',
};

function priorityFor(type: string): Priority {
  return PRIORITY_MAP[type] ?? 'P3';
}

function labelFor(type: string): string {
  return LABEL_MAP[type] ?? type.replace(/^een\.|\.v\d+$/g, '').replace(/([A-Z])/g, ' $1').trim();
}

// Extract ESN from actor string "camera:{esn}"
function esnFromActor(actor: string): string | null {
  const match = actor.match(/^camera:(.+)$/);
  return match ? match[1] : null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // Always return 200 first-thing to acknowledge receipt.
  // Process async so EEN doesn't timeout waiting for DB writes.
  const bodyText = await request.text();

  // Fire-and-forget processing — don't await
  processEvents(bodyText).catch(err =>
    console.error('[webhooks/eagleeye] Processing error:', err.message)
  );

  return NextResponse.json({ received: true }, { status: 200 });
}

async function processEvents(bodyText: string) {
  let payload: EENEvent | EENEvent[];

  try {
    payload = JSON.parse(bodyText);
  } catch {
    console.error('[webhooks/eagleeye] Invalid JSON body');
    return;
  }

  const events: EENEvent[] = Array.isArray(payload) ? payload : [payload];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (const event of events) {
    await processEvent(supabase, event);
  }
}

async function processEvent(supabase: any, event: EENEvent) {
  const esn = esnFromActor(event.actor);

  if (!esn) {
    console.log(`[webhooks/eagleeye] Skipping non-camera event: ${event.actor}`);
    return;
  }

  // Skip P4 device-status events — don't create alarms for them
  const priority = priorityFor(event.type);
  if (priority === 'P4') {
    console.log(`[webhooks/eagleeye] P4 device event skipped: ${event.type}`);
    return;
  }

  // Look up camera + zone + account from Supabase using ESN
  const { data: camera, error: camErr } = await supabase
    .from('cameras')
    .select('id, name, zone_id, account_id, monitored_events, schedule_override')
    .eq('een_camera_id', esn)
    .maybeSingle();

  if (camErr || !camera) {
    console.warn(`[webhooks/eagleeye] Camera not found for ESN ${esn} — alarm dropped`);
    return;
  }

  // Check per-camera event type filter (monitored_events)
  // null = all types allowed; array = only listed types create alarms
  const allowedTypes: string[] | null = camera.monitored_events ?? null;
  if (allowedTypes !== null && !allowedTypes.includes(event.type)) {
    console.log(`[webhooks/eagleeye] Event type ${event.type} not in monitored_events for camera ${esn} — skipped`);
    return;
  }

  // Look up zone for schedule check + display name
  const { data: zone } = await supabase
    .from('zones')
    .select('name, timezone, weekly_schedule, schedule_start, schedule_end')
    .eq('id', camera.zone_id)
    .maybeSingle();

  // Enforce monitoring schedule — skip alarm if outside active hours
  const eventMs = event.startTimestamp ? new Date(event.startTimestamp).getTime() : Date.now();
  if (zone && !isCameraWithinMonitoringHours(camera, zone, eventMs)) {
    console.log(`[webhooks/eagleeye] Event outside monitoring hours for camera ${esn} — skipped`);
    return;
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('name')
    .eq('id', camera.account_id)
    .maybeSingle();

  const siteName = [account?.name, zone?.name].filter(Boolean).join(' — ') || 'Unknown Site';

  // Insert alarm — select id so we can attach snapshot immediately after
  const { data: inserted, error: insertErr } = await supabase
    .from('alarms')
    .insert({
      priority,
      event_type:  event.type,
      event_label: labelFor(event.type),
      site_name:   siteName,
      camera_id:   camera.id,
      zone_id:     camera.zone_id,
      account_id:  camera.account_id,
      source:      'een',
      status:      'pending',
      created_at:  event.startTimestamp ?? new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    console.error(`[webhooks/eagleeye] Failed to insert alarm:`, insertErr?.message);
    return;
  }

  console.log(`[webhooks/eagleeye] Alarm created — ${priority} ${labelFor(event.type)} @ ${siteName}`);

  // Capture JPEG snapshot from EEN and store in Supabase Storage.
  // Fire-and-forget relative to alarm insert — alarm appears in queue immediately,
  // snapshot_url populates ~1-2s later and triggers realtime update on the card.
  captureAlarmSnapshot(supabase, inserted.id, esn, camera.account_id).catch(err =>
    console.warn('[webhooks/eagleeye] Snapshot capture failed (non-fatal):', err.message)
  );
}

// ─── Snapshot capture ─────────────────────────────────────────────────────────
async function captureAlarmSnapshot(
  supabase:  any,
  alarmId:   string,
  esn:       string,
  accountId: string,
): Promise<void> {
  // 1. Get EEN token
  const { token, cluster, apiKey } = await getValidEENToken(accountId);
  if (!cluster || !token) {
    console.warn(`[snapshot] No EEN token for account ${accountId} — skipping snapshot`);
    return;
  }

  // 2. Fetch JPEG from EEN (8s timeout — don't hold up other events)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        'image/jpeg',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  const imgRes = await fetch(
    `https://${cluster}/api/v3.0/cameras/${encodeURIComponent(esn)}/image`,
    { headers, signal: AbortSignal.timeout(8000) }
  );

  if (!imgRes.ok) {
    console.warn(`[snapshot] EEN image fetch ${imgRes.status} for ESN ${esn} — skipping`);
    return;
  }

  const imageBuffer = Buffer.from(await imgRes.arrayBuffer());

  // 3. Upload to Supabase Storage bucket 'alarm-snapshots'
  const path = `${alarmId}.jpg`;
  const { error: uploadErr } = await supabase.storage
    .from('alarm-snapshots')
    .upload(path, imageBuffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    // Most likely cause: bucket doesn't exist yet. Log clearly.
    console.warn(`[snapshot] Storage upload failed — is 'alarm-snapshots' bucket created? Error: ${uploadErr.message}`);
    return;
  }

  // 4. Get public URL and write back to alarm row
  const { data: { publicUrl } } = supabase.storage
    .from('alarm-snapshots')
    .getPublicUrl(path);

  await supabase.from('alarms').update({ snapshot_url: publicUrl }).eq('id', alarmId);
  console.log(`[snapshot] ✓ Snapshot stored for alarm ${alarmId}`);
}
