// app/api/gate-monitor/scan/route.ts
//
// Debug endpoint — runs Vision on a gate camera right now and returns the raw result.
// Used by the Setup page Vision Debug panel.
//
// POST { cameraId: string }
// → fetches live EEN JPEG
// → runs Claude Haiku Vision with gate type + region context
// → returns { image_data, gates, scanned_at }
//
// Does NOT write to gate_monitor_states — read-only diagnostic only.

import { NextResponse }          from 'next/server';
import { createClient }          from '@supabase/supabase-js';
import Anthropic                 from '@anthropic-ai/sdk';
import { getValidEENToken }      from '@/lib/een';
import { buildGateVisionPrompt } from '@/lib/gate-vision';

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

  // Fetch live JPEG — try multiple URL variants since EEN V3 behaviour varies by account/camera
  const imgHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        'image/jpeg, */*',
  };
  const jsonHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        'application/json',
  };
  if (apiKey) { imgHeaders['x-api-key'] = apiKey; jsonHeaders['x-api-key'] = apiKey; }

  const esn       = encodeURIComponent(cam.een_camera_id);
  const nowIso    = new Date().toISOString();
  const baseUrl   = `https://${cluster}/api/v3.0/cameras/${esn}`;

  // Step 1: Ask EEN for camera details — the response may include an imageUrl field
  // that points to the actual preview image (may be a signed CDN URL, not the /image path)
  let eenImageUrl: string | null = null;
  try {
    const camInfoRes = await fetch(`${baseUrl}`, { headers: jsonHeaders, signal: AbortSignal.timeout(5000) });
    if (camInfoRes.ok) {
      const camInfo = await camInfoRes.json();
      // EEN V3 camera object may have imageUrl, previewImageUrl, or similar fields
      eenImageUrl = camInfo?.imageUrl ?? camInfo?.previewUrl ?? camInfo?.thumbnail ?? null;
      console.log(`[gate-monitor/scan] EEN camera info keys: ${Object.keys(camInfo ?? {}).join(', ')}`);
    }
  } catch { /* non-fatal */ }

  // Step 2: Try image URLs in order — EEN-provided URL first, then standard variants
  const candidates = [
    ...(eenImageUrl ? [eenImageUrl] : []),
    `${baseUrl}/image`,
    `${baseUrl}/image?timestamp=${nowIso}`,
    `${baseUrl}/image?type=preview`,
    `${baseUrl}/image?type=main`,
  ];

  let imgRes: Response | null = null;
  let usedUrl = '';
  for (const url of candidates) {
    const r = await fetch(url, { headers: imgHeaders, signal: AbortSignal.timeout(8000) });
    if (r.ok && r.headers.get('content-type')?.startsWith('image/')) {
      imgRes = r; usedUrl = url; break;
    }
    console.log(`[gate-monitor/scan] ${url} → ${r.status} (${r.headers.get('content-type')})`);
  }

  if (!imgRes) {
    return NextResponse.json(
      {
        error: `EEN image not available for this camera (tried ${candidates.length} URL variants)`,
        debug: {
          tried:          candidates,
          een_image_url:  eenImageUrl,
          esn:            cam.een_camera_id,
          cluster,
          account_id:     cam.account_id,
          has_token:      !!token,
          has_apikey:     !!apiKey,
        },
      },
      { status: 502 }
    );
  }
  console.log(`[gate-monitor/scan] Image fetched via: ${usedUrl}`);

  const imageBuffer  = Buffer.from(await imgRes.arrayBuffer());
  const base64Image  = imageBuffer.toString('base64');

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
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
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
    camera_name: cam.name,
    configs,
    gates:       visionData.gates,
    image_data:  `data:image/jpeg;base64,${base64Image}`,
    scanned_at:  new Date().toISOString(),
  });
}
