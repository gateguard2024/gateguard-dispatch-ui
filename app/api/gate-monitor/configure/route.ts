// app/api/gate-monitor/configure/route.ts
//
// CRUD for gate camera configuration.
// Called from the Setup page CameraConfigPanel.
//
// GET  ?cameraId=uuid  → returns existing gate config for a camera
// POST { cameraId, gates: [{ gate_index, gate_label, idle_threshold_seconds }] }
//      → upserts gate configs (replaces all gates for that camera)
//      → also upserts gate_monitor_states rows so the cron can track state

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cameraId = searchParams.get('cameraId');

  if (!cameraId) {
    return NextResponse.json({ error: 'cameraId required' }, { status: 400 });
  }

  const supabase = makeClient();

  const { data, error } = await supabase
    .from('gate_camera_configs')
    .select('*')
    .eq('camera_id', cameraId)
    .order('gate_index');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ gates: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { cameraId, gates } = body as {
    cameraId: string;
    gates: Array<{
      gate_index:             number;
      gate_label:             string;
      gate_type:              string;
      region:                 { x: number; y: number; w: number; h: number } | null;
      idle_threshold_seconds: number;
      enabled:                boolean;
    }>;
  };

  if (!cameraId || !Array.isArray(gates)) {
    return NextResponse.json({ error: 'cameraId and gates[] required' }, { status: 400 });
  }

  const supabase = makeClient();

  // Delete existing config for this camera (full replace)
  await supabase.from('gate_camera_configs').delete().eq('camera_id', cameraId);

  if (gates.length === 0) {
    // Disabled — also clear monitor states
    await supabase.from('gate_monitor_states').delete().eq('camera_id', cameraId);
    return NextResponse.json({ success: true, gates: [] });
  }

  // Insert new gate configs
  const { data: inserted, error: insertErr } = await supabase
    .from('gate_camera_configs')
    .insert(gates.map(g => ({
      camera_id:              cameraId,
      gate_index:             g.gate_index,
      gate_label:             g.gate_label,
      gate_type:              g.gate_type  ?? 'barrier_arm',
      region:                 g.region     ?? null,
      idle_threshold_seconds: g.idle_threshold_seconds,
      enabled:                g.enabled,
    })))
    .select();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Ensure gate_monitor_states rows exist for each gate (state starts as 'closed')
  // The cron needs these rows to exist with correct gate_label before it can update them.
  await supabase
    .from('gate_monitor_states')
    .upsert(
      gates.map(g => ({
        camera_id:  cameraId,
        gate_label: g.gate_label,
        status:     'closed',
      })),
      { onConflict: 'camera_id,gate_label', ignoreDuplicates: false }
    );

  console.log(`[gate-monitor/configure] Saved ${gates.length} gate(s) for camera ${cameraId}`);

  return NextResponse.json({ success: true, gates: inserted });
}
