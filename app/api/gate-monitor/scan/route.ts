// app/api/gate-monitor/scan/route.ts
//
// Debug endpoint — runs Vision on a gate camera right now and returns the raw result.
// Used by the Setup page Vision Debug panel.
//
// POST { cameraId: string }
// → fetches live EEN JPEG via lib/een-image.ts (still API → media JPEG → HLS+ffmpeg)
// → runs Claude Haiku Vision with gate type + region context
// → returns { image_data, gates, scanned_at }
//
// Does NOT write to gate_monitor_states — read-only diagnostic only.

import { NextResponse }                    from 'next/server';
import { createClient }                    from '@supabase/supabase-js';
import Anthropic                           from '@anthropic-ai/sdk';
import { getValidEENToken }                from '@/lib/een';
import { buildGateVisionPrompt }           from '@/lib/gate-vision';
import { fetchEenCameraImage }             from '@/lib/een-image';
import { annotateGateRegions, GATE_COLORS } from '@/lib/image-annotate';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

  // Load gate configs (includes gate_type + region)
  const { data: configs, error: configErr } = await supabase
    .from('gate_camera_configs')
    .select('gate_label, gate_type, region, gate_index, idle_threshold_seconds')
    .eq('camera_id', cameraId)
    .eq('enabled', true)
    .order('gate_index');

  if (configErr || !configs?.length) {
    return NextResponse.json(
      { error: 'No enabled gate configs for this camera. Save Gate Config first.' },
      { status: 400 }
    );
  }

  // Load camera
  const { data: cam, error: camErr } = await supabase
    .from('cameras')
    .select('id, name, een_camera_id, account_id')
    .eq('id', cameraId)
    .maybeSingle();

  if (camErr || !cam?.een_camera_id) {
    return NextResponse.json({ error: 'Camera not found or missing EEN ID' }, { status: 404 });
  }

  // Get EEN token
  const { token, cluster, apiKey } = await getValidEENToken(cam.account_id);
  if (!token || !cluster) {
    return NextResponse.json(
      { error: 'No active EEN token for this camera\'s account' },
      { status: 502 }
    );
  }

  // ── Fetch JPEG via shared strategy: still API → media JPEG → HLS + ffmpeg ──
  const { buffer: imageBuffer, method: usedMethod, debug } = await fetchEenCameraImage(
    cam.een_camera_id,
    cluster,
    token,
    apiKey,
  );

  if (!imageBuffer) {
    return NextResponse.json(
      {
        error: 'Could not retrieve a camera image — all methods failed (still API 404, media JPEG 404, HLS ffmpeg failed).',
        debug: { esn: cam.een_camera_id, cluster, has_token: !!token, ...debug },
      },
      { status: 502 }
    );
  }

  // Validate JPEG header (FF D8 FF)
  const isValidJpeg = imageBuffer.length > 3 &&
    imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF;

  console.log(`[gate-monitor/scan] ${usedMethod} → ${imageBuffer.length}B, jpeg=${isValidJpeg}`);

  if (!isValidJpeg) {
    return NextResponse.json(
      {
        error: `Image retrieved (${imageBuffer.length}B via ${usedMethod}) but not a valid JPEG. First bytes: ${
          Array.from(imageBuffer.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
        }`,
        debug: { esn: cam.een_camera_id, cluster, has_token: !!token, method: usedMethod, ...debug },
      },
      { status: 502 }
    );
  }

  // ── Burn gate labels into the image so Claude can read them directly ────────
  // This is the digital equivalent of painting "G1 EXIT / G2 GUEST / G3 RESIDENT"
  // on the pavement in each lane. Claude sees the text IN the frame and never
  // has to guess which gate is which from verbal spatial descriptions alone.
  const annotationGates = configs.map((c, i) => ({
    label:     c.gate_label,
    gate_type: c.gate_type ?? 'barrier_arm',
    region:    c.region    ?? null,
    color:     GATE_COLORS[i % GATE_COLORS.length],
  }));
  const annotatedBuffer = await annotateGateRegions(imageBuffer, annotationGates);

  const base64Image = annotatedBuffer.toString('base64');
  const mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';

  // Run Claude Vision with full gate context
  const gatePromptConfigs = configs.map(c => ({
    gate_label: c.gate_label,
    gate_type:  c.gate_type  ?? 'barrier_arm',
    region:     c.region     ?? null,
  }));

  let visionData: { gates: Array<{
    label: string;
    status: string;
    traffic_flowing: boolean;
    vehicle_present: boolean;
    confidence: number;
  }> };

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text',  text: buildGateVisionPrompt(gatePromptConfigs) },
        ],
      }],
    });

    const raw     = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    visionData = JSON.parse(cleaned);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Vision failed: ${err.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    camera_name:    cam.name,
    configs,
    gates:          visionData.gates,
    image_data:     `data:image/jpeg;base64,${base64Image}`, // annotated — what Claude actually saw
    method:         usedMethod,
    annotated:      annotationGates.some(g => g.region !== null),
    scanned_at:     new Date().toISOString(),
  });
}
