// app/api/gate-monitor/trigger/route.ts
//
// Manually opens a 5-minute Vision monitoring window for a specific camera.
// Called from Setup → Camera Config → "Test Gate Monitor" button.
// Lets the team verify gate detection works without waiting for a real motion event.
//
// POST { cameraId: string }
// → Sets monitoring_until = now + 5min on all gate_monitor_states for that camera
// → Returns { opened: number } gates activated

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { cameraId } = body as { cameraId?: string };

  if (!cameraId) {
    return NextResponse.json({ error: 'cameraId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check that this camera has gate configs
  const { data: configs } = await supabase
    .from('gate_camera_configs')
    .select('gate_label')
    .eq('camera_id', cameraId)
    .eq('enabled', true);

  if (!configs?.length) {
    return NextResponse.json(
      { error: 'No enabled gate configs for this camera. Enable Gate Monitor in Setup first.' },
      { status: 400 }
    );
  }

  // Open a 5-minute monitoring window on each gate state row
  const monitoringUntil = new Date(Date.now() + 5 * 60_000).toISOString();

  const { error: upsertErr } = await supabase
    .from('gate_monitor_states')
    .upsert(
      configs.map((gc: any) => ({
        camera_id:        cameraId,
        gate_label:       gc.gate_label,
        monitoring_until: monitoringUntil,
        last_checked_at:  new Date().toISOString(),
      })),
      { onConflict: 'camera_id,gate_label' }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  console.log(
    `[gate-monitor/trigger] Manual window opened — camera ${cameraId}, ` +
    `${configs.length} gate(s), until ${monitoringUntil}`
  );

  return NextResponse.json({
    success: true,
    opened:  configs.length,
    gates:   configs.map((g: any) => g.gate_label),
    until:   monitoringUntil,
  });
}
