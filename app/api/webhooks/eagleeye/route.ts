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

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  // P1 — Active security threats
  'een.intrusionDetection.v1':      'P1',
  'een.tamperDetection.v1':         'P1',
  'een.loiteringDetection.v1':      'P1',
  'een.trespassDetection.v1':       'P1',
  'een.sabotagDetection.v1':        'P1',
  'een.accessDenied.v1':            'P1',

  // P2 — Person / vehicle / object
  'een.personDetection.v1':         'P2',
  'een.vehicleDetection.v1':        'P2',
  'een.objectDetection.v1':         'P2',
  'een.crowdDetection.v1':          'P2',
  'een.crossLineDetection.v1':      'P2',

  // P3 — General motion
  'een.motionDetection.v1':         'P3',

  // P4 — Device / system health
  'een.deviceCloudStatusUpdate.v1': 'P4',
  'een.deviceOnline.v1':            'P4',
  'een.deviceOffline.v1':           'P4',
};

const LABEL_MAP: Record<string, string> = {
  'een.intrusionDetection.v1':      'Intrusion Detected',
  'een.tamperDetection.v1':         'Camera Tampered',
  'een.loiteringDetection.v1':      'Loitering Detected',
  'een.trespassDetection.v1':       'Trespass Detected',
  'een.sabotagDetection.v1':        'Sabotage Detected',
  'een.accessDenied.v1':            'Access Denied',
  'een.personDetection.v1':         'Person Detected',
  'een.vehicleDetection.v1':        'Vehicle Detected',
  'een.objectDetection.v1':         'Object Detected',
  'een.crowdDetection.v1':          'Crowd Detected',
  'een.crossLineDetection.v1':      'Line Crossing Detected',
  'een.motionDetection.v1':         'Motion Detected',
  'een.deviceCloudStatusUpdate.v1': 'Device Status Change',
  'een.deviceOnline.v1':            'Device Online',
  'een.deviceOffline.v1':           'Device Offline',
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

async function processEvent(supabase: ReturnType<typeof createClient>, event: EENEvent) {
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
    .select('id, name, zone_id, account_id')
    .eq('een_camera_id', esn)
    .maybeSingle();

  if (camErr || !camera) {
    console.warn(`[webhooks/eagleeye] Camera not found for ESN ${esn} — alarm dropped`);
    return;
  }

  // Look up zone name + account name for display
  const { data: zone } = await supabase
    .from('zones')
    .select('name')
    .eq('id', camera.zone_id)
    .maybeSingle();

  const { data: account } = await supabase
    .from('accounts')
    .select('name')
    .eq('id', camera.account_id)
    .maybeSingle();

  const siteName = [account?.name, zone?.name].filter(Boolean).join(' — ') || 'Unknown Site';

  // Insert alarm
  const { error: insertErr } = await supabase.from('alarms').insert({
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
  });

  if (insertErr) {
    console.error(`[webhooks/eagleeye] Failed to insert alarm:`, insertErr.message);
  } else {
    console.log(`[webhooks/eagleeye] Alarm created — ${priority} ${labelFor(event.type)} @ ${siteName}`);
  }
}
