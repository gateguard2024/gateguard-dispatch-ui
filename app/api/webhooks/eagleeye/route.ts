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

// ─── Portal bridge ────────────────────────────────────────────────────────────
// Fire-and-forget: bridge a new alarm to the GateGuard Portal /incidents page.
// Failures are logged but never block EEN acknowledgement.

const SEVERITY_MAP: Record<Priority, string> = {
  P1: 'critical',
  P2: 'high',
  P3: 'medium',
  P4: 'low',
};

async function bridgeAlarmToPortal(opts: {
  alarmId: string;
  eventLabel: string;
  eventType: string;
  siteName: string;
  priority: Priority;
}) {
  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.gateguard.co';
  try {
    await fetch(`${portalUrl}/api/incidents/ingest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:         opts.eventLabel,
        description:   `${opts.priority} alarm from GGSOC — ${opts.siteName}`,
        severity:      SEVERITY_MAP[opts.priority] ?? 'medium',
        source:        'ggsoc',
        source_ext_id: opts.alarmId,
        source_system: 'ggsoc',
        metadata: {
          alarmId:   opts.alarmId,
          priority:  opts.priority,
          eventType: opts.eventType,
          siteName:  opts.siteName,
        },
      }),
    });
    console.log(`[webhooks/eagleeye] 🔗 Portal bridge: alarm ${opts.alarmId} → incident created`);
  } catch (err: any) {
    console.error(`[webhooks/eagleeye] Portal bridge failed for alarm ${opts.alarmId}:`, err.message);
  }
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

    // Bridge all P1/P2/P3 alarms to Portal incidents (P4 is already skipped above)
    {
      // Get the inserted alarm ID for cross-referencing
      const { data: inserted } = await supabase
        .from('alarms')
        .select('id')
        .eq('source', 'een')
        .eq('event_type', event.type)
        .eq('camera_id', camera.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inserted?.id) {
        void bridgeAlarmToPortal({
          alarmId:    inserted.id,
          eventLabel: labelFor(event.type),
          eventType:  event.type,
          siteName,
          priority,
        });
      }
    }
  }
}
