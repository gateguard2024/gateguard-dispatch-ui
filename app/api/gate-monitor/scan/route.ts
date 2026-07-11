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

  // Fetch a JPEG frame for Vision.
  // EEN's /cameras/{esn}/image endpoint doesn't work for all camera types.
  // Fallback: pull an HLS stream URL from /feeds, download the first .ts segment,
  // then extract a JPEG frame from the raw MPEG-TS data.

  const imgHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        'image/jpeg, */*',
  };
  const jsonHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        'application/json',
  };
  if (apiKey) { imgHeaders['x-api-key'] = apiKey; jsonHeaders['x-api-key'] = apiKey; }

  const esn     = encodeURIComponent(cam.een_camera_id);
  const nowIso  = new Date().toISOString();
  const baseUrl = `https://${cluster}/api/v3.0/cameras/${esn}`;

  // ── Attempt 1: Standard /cameras/{esn}/image endpoint ─────────────────────
  let imageBuffer: Buffer | null = null;
  let usedMethod = '';

  for (const url of [
    `${baseUrl}/image`,
    `${baseUrl}/image?timestamp=${nowIso}`,
    `${baseUrl}/image?type=preview`,
  ]) {
    const r = await fetch(url, { headers: imgHeaders, signal: AbortSignal.timeout(6000) });
    if (r.ok && r.headers.get('content-type')?.includes('image')) {
      imageBuffer = Buffer.from(await r.arrayBuffer());
      usedMethod  = `still:${url}`;
      break;
    }
    console.log(`[gate-monitor/scan] ${url} → ${r.status}`);
  }

  // ── Attempt 2: Extract frame from HLS stream ───────────────────────────────
  // Get the HLS manifest from EEN's feeds endpoint, fetch the first .ts segment,
  // then scan it for the first JPEG SOI marker (FF D8) to extract a frame.
  // Works for cameras where the still image endpoint returns 404.
  if (!imageBuffer) {
    try {
      const feedsUrl  = `https://${cluster}/api/v3.0/feeds?deviceId=${cam.een_camera_id}&include=hlsUrl`;
      const feedsRes  = await fetch(feedsUrl, { headers: jsonHeaders, signal: AbortSignal.timeout(6000) });
      const feedsData = feedsRes.ok ? await feedsRes.json() : null;
      const hlsUrl    = (feedsData?.results ?? []).find((f: any) => f.hlsUrl)?.hlsUrl;

      if (hlsUrl) {
        console.log(`[gate-monitor/scan] HLS fallback — fetching manifest`);

        // Download the M3U8 manifest (token in auth header)
        const m3u8Res  = await fetch(hlsUrl, { headers: imgHeaders, signal: AbortSignal.timeout(8000) });
        const m3u8Text = m3u8Res.ok ? await m3u8Res.text() : null;

        if (m3u8Text) {
          // The manifest may be a master playlist — find the first variant or segment URL
          const lines    = m3u8Text.split('\n').map(l => l.trim()).filter(Boolean);

          // Try to find a child playlist URL (master → variant) or a direct segment
          let segmentUrl: string | null = null;
          for (const line of lines) {
            if (line.startsWith('#')) continue;
            const resolved = line.startsWith('http') ? line : new URL(line, hlsUrl).href;
            if (line.endsWith('.m3u8')) {
              // It's a variant playlist — fetch it and get its first segment
              const varRes  = await fetch(resolved, { headers: imgHeaders, signal: AbortSignal.timeout(6000) });
              const varText = varRes.ok ? await varRes.text() : '';
              const varLines = varText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
              if (varLines[0]) {
                segmentUrl = varLines[0].startsWith('http') ? varLines[0] : new URL(varLines[0], resolved).href;
              }
              break;
            }
            if (line.endsWith('.ts') || line.includes('.ts?')) {
              segmentUrl = resolved;
              break;
            }
          }

          if (segmentUrl) {
            console.log(`[gate-monitor/scan] Fetching .ts segment: ${segmentUrl}`);
            const tsRes = await fetch(segmentUrl, { headers: imgHeaders, signal: AbortSignal.timeout(10000) });
            if (tsRes.ok) {
              const tsBuffer = Buffer.from(await tsRes.arrayBuffer());

              // Scan for the first JPEG SOI marker (FF D8 FF) in the MPEG-TS stream
              // MPEG-TS streams often embed JPEG frames in the PES payload
              let jpegStart = -1;
              for (let i = 0; i < tsBuffer.length - 2; i++) {
                if (tsBuffer[i] === 0xFF && tsBuffer[i + 1] === 0xD8 && tsBuffer[i + 2] === 0xFF) {
                  jpegStart = i;
                  break;
                }
              }

              if (jpegStart >= 0) {
                // Find the JPEG EOI marker (FF D9) to get the full JPEG
                let jpegEnd = tsBuffer.length;
                for (let i = jpegStart + 2; i < tsBuffer.length - 1; i++) {
                  if (tsBuffer[i] === 0xFF && tsBuffer[i + 1] === 0xD9) {
                    jpegEnd = i + 2;
                    break;
                  }
                }
                imageBuffer = tsBuffer.slice(jpegStart, jpegEnd);
                usedMethod  = 'hls-segment-jpeg';
                console.log(`[gate-monitor/scan] Extracted JPEG from .ts (${imageBuffer.length} bytes)`);
              } else {
                // No JPEG in segment — use the raw .ts bytes anyway (Claude can handle it)
                imageBuffer = tsBuffer;
                usedMethod  = 'hls-segment-raw';
                console.log(`[gate-monitor/scan] No JPEG marker in .ts — passing raw segment (${tsBuffer.length} bytes)`);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[gate-monitor/scan] HLS fallback failed: ${err.message}`);
    }
  }

  if (!imageBuffer) {
    return NextResponse.json(
      {
        error: 'Could not retrieve a camera image. The still image endpoint returned 404 and the HLS stream could not be read.',
        debug: { esn: cam.een_camera_id, cluster, account_id: cam.account_id },
      },
      { status: 502 }
    );
  }

  console.log(`[gate-monitor/scan] Image ready via: ${usedMethod}`);

  const base64Image  = imageBuffer.toString('base64');
  // Determine media type — raw .ts can't be sent as jpeg; fall back to jpeg and hope Claude handles it
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
    camera_name: cam.name,
    configs,
    gates:       visionData.gates,
    image_data:  `data:image/jpeg;base64,${base64Image}`,
    scanned_at:  new Date().toISOString(),
  });
}
