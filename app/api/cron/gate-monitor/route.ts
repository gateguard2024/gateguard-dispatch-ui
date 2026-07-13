// app/api/cron/gate-monitor/route.ts
//
// Vercel Cron — runs every minute  (vercel.json: "* * * * *")
//
// Vision-based gate monitoring using Claude Haiku + EEN image API.
// Replaces the old rule-based alarm escalation approach.
//
// Flow:
//   1. Find gate_monitor_states rows where monitoring_until > now()
//   2. Group by camera so each image is fetched once per camera
//   3. For each active camera → fetch EEN JPEG → Claude Vision → structured JSON
//   4. Per-gate state machine:
//        closed      → no action (or fire gate_restored if was stuck)
//        open_active → traffic flowing, reset idle timer
//        open_idle   → start/continue idle timer
//        stuck_open  → idle ≥ threshold → fire P1 alarm + site_events
//   5. Update gate_monitor_states
//
// Cost: ~$0.0002/Vision call. Only runs while monitoring_until > now().
// Monitoring windows are opened by the EEN motion webhook on gate cameras.

import { NextResponse }                     from 'next/server';
import { createClient }                     from '@supabase/supabase-js';
import Anthropic                            from '@anthropic-ai/sdk';
import { getValidEENToken }                 from '@/lib/een';
import { buildGateVisionPrompt }            from '@/lib/gate-vision';
import { fetchEenCameraImage }              from '@/lib/een-image';
import { annotateGateRegions, GATE_COLORS } from '@/lib/image-annotate';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Types ────────────────────────────────────────────────────────────────────
interface GateVisionResult {
  label:           string;
  status:          'open' | 'closed' | 'partial';
  traffic_flowing: boolean;
  vehicle_present: boolean;
  confidence:      number;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();

  const STATE_SELECT = `
    camera_id,
    gate_label,
    status,
    idle_since,
    stuck_alarm_id,
    monitoring_until,
    cameras (
      id,
      name,
      een_camera_id,
      account_id,
      zone_id,
      zones ( name ),
      gate_camera_configs ( gate_label, gate_type, region, idle_threshold_seconds, enabled )
    )
  `;

  // ── 1a. Gates with active monitoring windows ───────────────────────────────
  const { data: activeStates, error: stateErr } = await supabase
    .from('gate_monitor_states')
    .select(STATE_SELECT)
    .gt('monitoring_until', now.toISOString());

  if (stateErr) {
    console.error('[gate-monitor] State query error:', stateErr.message);
    return NextResponse.json({ error: stateErr.message }, { status: 500 });
  }

  // ── 1b. stuck_open gates whose window lapsed (cron gap recovery) ───────────
  // If the Vercel cron had a gap and a stuck gate fell out of its window,
  // we still need to check it so we can detect when it closes.
  const { data: stuckLapsed } = await supabase
    .from('gate_monitor_states')
    .select(STATE_SELECT)
    .eq('status', 'stuck_open')
    .or(`monitoring_until.is.null,monitoring_until.lt.${now.toISOString()}`);

  // Re-open monitoring window for any recovered stuck gates so they stay watched
  if (stuckLapsed?.length) {
    const recovered = new Date(now.getTime() + 30 * 60_000).toISOString();
    await supabase
      .from('gate_monitor_states')
      .update({ monitoring_until: recovered })
      .eq('status', 'stuck_open')
      .or(`monitoring_until.is.null,monitoring_until.lt.${now.toISOString()}`);
    console.log(`[gate-monitor] Recovered ${stuckLapsed.length} stuck gate(s) with lapsed monitoring window`);
  }

  // Merge — deduplicate by camera_id + gate_label (active window takes precedence)
  const seen = new Set<string>();
  const allStates: typeof activeStates = [];
  for (const s of [...(activeStates ?? []), ...(stuckLapsed ?? [])]) {
    const key = `${s.camera_id}:${s.gate_label}`;
    if (!seen.has(key)) { seen.add(key); allStates.push(s); }
  }

  if (!allStates.length) {
    return NextResponse.json({ checked: 0, message: 'No active gate monitoring windows' });
  }

  // ── 2. Group by camera_id — one image fetch per camera ────────────────────
  const byCameraId = new Map<string, typeof allStates>();
  for (const state of allStates) {
    if (!byCameraId.has(state.camera_id)) byCameraId.set(state.camera_id, []);
    byCameraId.get(state.camera_id)!.push(state);
  }

  let checked = 0, alerts = 0, restorations = 0;

  for (const [cameraId, states] of byCameraId) {
    try {
      const cam = states[0].cameras as any;
      if (!cam?.een_camera_id) {
        console.warn(`[gate-monitor] Camera ${cameraId} has no een_camera_id — skipping`);
        continue;
      }

      const accountId = cam.account_id ?? cam.zones?.account_id;
      if (!accountId) continue;

      // ── 3. Get EEN token + fetch JPEG ──────────────────────────────────────
      const { token, cluster, apiKey } = await getValidEENToken(accountId);
      if (!token || !cluster) {
        console.warn(`[gate-monitor] No EEN token for account ${accountId}`);
        continue;
      }

      // Use shared image strategy: still API → media JPEG → HLS + ffmpeg
      const { buffer: imgBuffer, method: imgMethod, debug: imgDebug } = await fetchEenCameraImage(
        cam.een_camera_id,
        cluster,
        token,
        apiKey,
      );

      if (!imgBuffer) {
        console.warn(`[gate-monitor] Could not get image for ${cam.name}:`, JSON.stringify(imgDebug));
        continue;
      }

      console.log(`[gate-monitor] Got image via ${imgMethod} (${imgBuffer.length}B) for ${cam.name}`);

      // ── 4. Claude Haiku Vision ─────────────────────────────────────────────
      const configs      = (cam.gate_camera_configs as any[]) ?? [];

      // Annotate the frame with gate labels before sending to Claude Vision.
      // Burns "1: EXIT GATE", "2: GUEST GATE", etc. into the JPEG so Claude
      // reads gate identities directly from the image — no spatial guessing.
      const annotationGates = configs.map((cfg: any, i: number) => ({
        label:     cfg.gate_label,
        gate_type: cfg.gate_type ?? 'barrier_arm',
        region:    cfg.region    ?? null,
        color:     GATE_COLORS[i % GATE_COLORS.length],
      }));
      const annotatedBuffer = await annotateGateRegions(imgBuffer, annotationGates);
      const base64Image = annotatedBuffer.toString('base64');
      const gatePromptConfigs = states.map(s => {
        const cfg = configs.find((c: any) => c.gate_label === s.gate_label) ?? {};
        return {
          gate_label: s.gate_label,
          gate_type:  cfg.gate_type ?? 'barrier_arm',
          region:     cfg.region    ?? null,
        };
      });

      const visionMsg = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
            },
            {
              type: 'text',
              text: buildGateVisionPrompt(gatePromptConfigs),
            },
          ],
        }],
      });

      const rawText = visionMsg.content[0].type === 'text' ? visionMsg.content[0].text : '';
      let visionData: { gates: GateVisionResult[] };

      try {
        const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        visionData = JSON.parse(cleaned);
      } catch {
        console.warn(
          `[gate-monitor] Vision JSON parse failed for ${cam.name}: ${rawText.slice(0, 200)}`
        );
        continue;
      }

      if (!Array.isArray(visionData?.gates)) continue;
      checked++;

      // ── 5. Per-gate state machine ──────────────────────────────────────────
      for (const gateResult of visionData.gates) {
        const state = states.find(s => s.gate_label === gateResult.label);
        if (!state) continue;

        const configs      = (cam.gate_camera_configs as any[]) ?? [];
        const config       = configs.find((c: any) => c.gate_label === gateResult.label && c.enabled);
        if (!config) continue;  // Gate disabled in config

        const idleThresholdSecs = config.idle_threshold_seconds ?? 300;
        const gateOpen          = gateResult.status === 'open' || gateResult.status === 'partial';
        const isPartial         = gateResult.status === 'partial';
        const isActive          = gateResult.traffic_flowing && !isPartial;

        // ── CLOSED ──────────────────────────────────────────────────────────
        if (!gateOpen) {
          if (state.status === 'stuck_open') {
            await fireGateRestored(supabase, cameraId, gateResult.label, state, cam, accountId);
            restorations++;
          }
          await upsertState(supabase, cameraId, gateResult.label, {
            status:          'closed',
            idle_since:      null,
            stuck_alarm_id:  null,
            last_checked_at: now.toISOString(),
          });
          continue;
        }

        // ── OPEN + ACTIVE TRAFFIC ────────────────────────────────────────────
        if (isActive) {
          await upsertState(supabase, cameraId, gateResult.label, {
            status:          'open_active',
            idle_since:      null,
            last_checked_at: now.toISOString(),
          });
          continue;
        }

        // ── OPEN + IDLE ──────────────────────────────────────────────────────
        // Use existing idle_since to accumulate time; don't reset unless traffic flows
        const idleSince   = state.idle_since ? new Date(state.idle_since) : now;
        const idleSeconds = (now.getTime() - idleSince.getTime()) / 1000;
        const thresholdHit = idleSeconds >= idleThresholdSecs || isPartial;

        if (thresholdHit) {
          if (state.status !== 'stuck_open') {
            // First crossing — fire alarm
            const alarmId = await fireGateStuckOpen(
              supabase, cameraId, gateResult.label, cam, accountId, idleSeconds
            );
            alerts++;
            await upsertState(supabase, cameraId, gateResult.label, {
              status:           'stuck_open',
              idle_since:       idleSince.toISOString(),
              stuck_alarm_id:   alarmId,
              last_checked_at:  now.toISOString(),
              monitoring_until: new Date(now.getTime() + 30 * 60_000).toISOString(),
            });
          } else {
            // Already alerted — extend monitoring window to catch restoration
            await supabase
              .from('gate_monitor_states')
              .update({
                last_checked_at:  now.toISOString(),
                monitoring_until: new Date(now.getTime() + 30 * 60_000).toISOString(),
              })
              .eq('camera_id', cameraId)
              .eq('gate_label', gateResult.label);
          }
        } else {
          // Idle but below threshold — update idle timer
          await upsertState(supabase, cameraId, gateResult.label, {
            status:          'open_idle',
            idle_since:      idleSince.toISOString(),
            last_checked_at: now.toISOString(),
          });
        }
      }

    } catch (err: any) {
      console.error(`[gate-monitor] Error on camera ${cameraId}:`, err.message);
    }
  }

  console.log(
    `[gate-monitor] Done — ${checked} cameras, ${alerts} stuck alerts, ${restorations} restorations`
  );
  return NextResponse.json({ checked, alerts, restorations });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// buildGateVisionPrompt is now in lib/gate-vision.ts (shared with scan endpoint)

/**
 * Fire-and-forget POST to portal.gateguard.co/api/webhooks/gate-alarm.
 * Surfaces gate alarms in the dealer portal so individual dealers see alerts
 * for their own properties on portal.gateguard.co/alerts.
 *
 * Requires env vars:
 *   PORTAL_URL             — e.g. https://portal.gateguard.co
 *   PORTAL_WEBHOOK_SECRET  — shared secret, verified by the portal webhook route
 *
 * Non-fatal: if the portal is unreachable or rejects the request, the SOC alarm
 * is still recorded — portal notify is best-effort.
 */
async function notifyPortal(payload: {
  event:         'gate_stuck_open' | 'gate_restored';
  account_id:    string;
  site_name:     string;
  gate_label:    string;
  alarm_id?:     string | null;
  idle_minutes?: number;
}): Promise<void> {
  const portalUrl     = process.env.PORTAL_URL;
  const webhookSecret = process.env.PORTAL_WEBHOOK_SECRET;

  if (!portalUrl || !webhookSecret) {
    console.warn('[gate-monitor] PORTAL_URL or PORTAL_WEBHOOK_SECRET not set — skipping portal notify');
    return;
  }

  try {
    const res = await fetch(`${portalUrl}/api/webhooks/gate-alarm`, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      console.log(
        `[gate-monitor] ✓ Portal notified: ${payload.event} for ${payload.gate_label}`,
        json.deduped ? '(deduped)' : `→ site ${json.site_name ?? json.site_id}`,
      );
    } else {
      const text = await res.text().catch(() => '');
      console.warn(`[gate-monitor] Portal webhook ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err: any) {
    console.warn('[gate-monitor] Portal webhook unreachable (non-fatal):', err.message);
  }
}

async function upsertState(
  supabase:  any,
  cameraId:  string,
  gateLabel: string,
  fields:    Record<string, any>,
) {
  await supabase
    .from('gate_monitor_states')
    .upsert(
      { camera_id: cameraId, gate_label: gateLabel, ...fields },
      { onConflict: 'camera_id,gate_label' }
    );
}

async function fireGateStuckOpen(
  supabase:    any,
  cameraId:    string,
  gateLabel:   string,
  cam:         any,
  accountId:   string,
  idleSeconds: number,
): Promise<string | null> {
  const siteName    = cam.zones?.name ?? cam.name ?? 'Unknown Site';
  const minutesIdle = Math.round(idleSeconds / 60);

  const { data: alarm } = await supabase
    .from('alarms')
    .insert({
      priority:      'P1',
      event_type:    'gate_stuck_open',
      event_label:   `Gate Left Open — ${gateLabel}`,
      site_name:     siteName,
      camera_id:     cameraId,
      zone_id:       cam.zone_id,
      account_id:    accountId,
      source:        'een',
      status:        'pending',
      created_at:    new Date().toISOString(),
      triage_status: 'escalated',
      triage_result: {
        decision:        'escalate',
        priority:        'P1',
        interpretation:  `${gateLabel} has been idle-open for ${minutesIdle} minute${minutesIdle !== 1 ? 's' : ''} with no active traffic — confirmed by Vision AI. Possible stuck gate, mechanical fault, or unauthorized prop-open.`,
        suggested_steps: [
          `View live camera feed for ${gateLabel} immediately`,
          'Check if the gate arm/barrier is physically stuck or being held open',
          'Attempt remote close via Brivo access control if available',
          'Contact on-site maintenance or property manager',
          'If unauthorized access confirmed, dispatch security or police',
        ],
        confidence:   92,
        reasoning:    `Vision AI confirmed ${gateLabel} idle-open for ${minutesIdle}min with no traffic.`,
        model:        'claude-haiku-vision',
        processed_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  console.log(
    `[gate-monitor] 🔴 STUCK OPEN: ${gateLabel} @ ${siteName} — ${minutesIdle}min → alarm ${alarm?.id}`
  );

  // Notify portal so dealers see this alert on portal.gateguard.co/alerts
  await notifyPortal({
    event:        'gate_stuck_open',
    account_id:   accountId,
    site_name:    siteName,
    gate_label:   gateLabel,
    alarm_id:     alarm?.id ?? null,
    idle_minutes: minutesIdle,
  });

  return alarm?.id ?? null;
}

async function fireGateRestored(
  supabase:  any,
  cameraId:  string,
  gateLabel: string,
  state:     any,
  cam:       any,
  accountId: string,
): Promise<void> {
  const siteName = cam.zones?.name ?? cam.name ?? 'Unknown Site';

  // Auto-resolve the stuck alarm
  if (state.stuck_alarm_id) {
    await supabase
      .from('alarms')
      .update({ status: 'resolved' })
      .eq('id', state.stuck_alarm_id);
  }

  // P4 audit-trail alarm (auto-resolved, surfaces in history)
  await supabase.from('alarms').insert({
    priority:    'P4',
    event_type:  'gate_restored',
    event_label: `Gate Restored — ${gateLabel}`,
    site_name:   siteName,
    camera_id:   cameraId,
    zone_id:     cam.zone_id,
    account_id:  accountId,
    source:      'een',
    status:      'resolved',
    created_at:  new Date().toISOString(),
  });

  console.log(`[gate-monitor] 🟢 RESTORED: ${gateLabel} @ ${siteName}`);

  // Notify portal to resolve the open alert and add an audit-trail event
  await notifyPortal({
    event:      'gate_restored',
    account_id: accountId,
    site_name:  siteName,
    gate_label: gateLabel,
    alarm_id:   state.stuck_alarm_id ?? null,
  });
}
