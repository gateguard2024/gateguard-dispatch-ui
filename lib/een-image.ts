// lib/een-image.ts
//
// Fetches a JPEG frame from an EEN camera using the best available method.
//
// Strategy (in order):
//   1. GET /api/v3.0/cameras/{esn}/image           — standard EEN still-image API
//   2. EEN media server /jpg/getJpeg               — camera-model-dependent
//   3. HLS → first .ts segment → ffmpeg extraction — always works if HLS works
//
// Returns: { buffer: Buffer; method: string; debug: Record<string,any> }
//          or { buffer: null; method: ''; debug: Record<string,any> } on failure

import { spawn } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string | null = require('ffmpeg-static');

export interface EenImageResult {
  buffer: Buffer | null;
  method: string;
  debug:  Record<string, any>;
}

/**
 * Pipe an MPEG-TS buffer through ffmpeg and capture the first video frame as JPEG.
 * Used when the camera encodes H.264 — no JPEG is embedded in the PES payload.
 */
async function extractJpegViaFfmpeg(
  tsBuffer: Buffer,
  debug:    Record<string, any>,
): Promise<Buffer | null> {
  if (!ffmpegPath) {
    debug.ffmpeg_error = 'ffmpeg-static binary not available';
    return null;
  }

  return new Promise((resolve) => {
    const ff = spawn(ffmpegPath, [
      '-i',       'pipe:0',   // stdin
      '-vframes', '1',         // 1 frame
      '-f',       'image2',    // output format
      '-vcodec',  'mjpeg',     // JPEG codec
      '-q:v',     '2',         // quality (2 = high)
      'pipe:1',                // stdout
    ]);

    const chunks: Buffer[] = [];
    const stderrParts: string[] = [];

    ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ff.stderr.on('data', (chunk: Buffer) => stderrParts.push(chunk.toString()));

    ff.on('error', (err: Error) => {
      debug.ffmpeg_error = err.message;
      resolve(null);
    });

    ff.on('close', (code: number | null) => {
      debug.ffmpeg_exit_code = code;
      if (stderrParts.length) {
        // Last 3 lines — ffmpeg stderr is very verbose
        debug.ffmpeg_stderr_tail = stderrParts
          .join('')
          .split('\n')
          .filter(Boolean)
          .slice(-3)
          .join(' | ');
      }
      if (code === 0 && chunks.length > 0) {
        const jpg = Buffer.concat(chunks);
        debug.ffmpeg_bytes = jpg.length;
        resolve(jpg);
      } else {
        debug.ffmpeg_error = (debug.ffmpeg_error ?? '') + ` exit:${code}`;
        resolve(null);
      }
    });

    ff.stdin.on('error', () => {}); // suppress EPIPE if ffmpeg exits early
    ff.stdin.write(tsBuffer);
    ff.stdin.end();
  });
}

/**
 * Attempt to pull a JPEG snapshot from an EEN camera.
 *
 * @param esn         EEN camera ID (ESN)
 * @param cluster     EEN API cluster host (e.g. "api.c031.eagleeyenetworks.com")
 * @param token       EEN bearer token
 * @param apiKey      Optional EEN API key header value
 */
export async function fetchEenCameraImage(
  esn:     string,
  cluster: string,
  token:   string,
  apiKey?: string | null,
): Promise<EenImageResult> {
  const debug: Record<string, any> = { esn, cluster, has_token: !!token };

  const authHeader: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (apiKey) authHeader['x-api-key'] = apiKey;

  const imgHeaders  = { ...authHeader, Accept: 'image/jpeg, */*' };
  const jsonHeaders = { ...authHeader, Accept: 'application/json' };

  const esnEncoded = encodeURIComponent(esn);
  const baseUrl    = `https://${cluster}/api/v3.0/cameras/${esnEncoded}`;

  // ── Strategy 1: Standard EEN still-image API ──────────────────────────────
  const nowIso = new Date().toISOString();
  for (const url of [
    `${baseUrl}/image`,
    `${baseUrl}/image?timestamp=${nowIso}`,
    `${baseUrl}/image?type=preview`,
  ]) {
    try {
      const r = await fetch(url, { headers: imgHeaders, signal: AbortSignal.timeout(3000) });
      debug[`still_${r.status}`] = url;
      if (r.ok && r.headers.get('content-type')?.includes('image')) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
          return { buffer: buf, method: `still-image:${url}`, debug };
        }
      }
    } catch {
      // timeout or network error — try next
    }
  }

  // ── Strategy 2+3: HLS → JPEG endpoint or ffmpeg frame extraction ──────────
  const hlsDebug: Record<string, any> = {};
  debug.hls = hlsDebug;

  try {
    // 2a. Get the HLS URL from /feeds
    const feedsUrl = `https://${cluster}/api/v3.0/feeds?deviceId=${esn}&include=hlsUrl`;
    const feedsRes = await fetch(feedsUrl, { headers: jsonHeaders, signal: AbortSignal.timeout(6000) });
    hlsDebug.feeds_status = feedsRes.status;

    const feedsData = feedsRes.ok ? await feedsRes.json() : null;
    const hlsUrl    = (feedsData?.results ?? []).find((f: any) => f.hlsUrl)?.hlsUrl ?? null;
    hlsDebug.hls_url    = hlsUrl ? hlsUrl.slice(0, 80) + '…' : null;
    hlsDebug.feed_count = feedsData?.results?.length ?? 0;

    if (!hlsUrl) {
      return { buffer: null, method: '', debug };
    }

    // 2b. Try the EEN media-server JPEG snapshot endpoint
    try {
      const jpegUrl = hlsUrl
        .replace('/hls/getPlaylist', '/jpg/getJpeg')
        .replace('/hls/getLivePlaylist', '/jpg/getJpeg');

      if (jpegUrl !== hlsUrl) {
        hlsDebug.jpeg_endpoint_tried  = jpegUrl.slice(0, 80) + '…';
        const jpegRes = await fetch(jpegUrl, {
          headers: { ...authHeader, Accept: 'image/jpeg, */*' },
          signal:  AbortSignal.timeout(10000),
        });
        hlsDebug.jpeg_endpoint_status = jpegRes.status;
        hlsDebug.jpeg_endpoint_type   = jpegRes.headers.get('content-type');

        if (jpegRes.ok && jpegRes.headers.get('content-type')?.includes('image')) {
          const buf = Buffer.from(await jpegRes.arrayBuffer());
          if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
            return { buffer: buf, method: 'media-jpeg-endpoint', debug };
          }
          hlsDebug.jpeg_endpoint_not_jpeg = true;
        }
      }
    } catch (e: any) {
      hlsDebug.jpeg_endpoint_error = e.message;
    }

    // 2c. Fetch HLS manifest → first .ts segment → extract frame
    const hlsHeaders = { ...authHeader, Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' };
    const tsHeaders  = { ...authHeader, Accept: 'video/MP2T, */*' };

    const m3u8Res = await fetch(hlsUrl, { headers: hlsHeaders, signal: AbortSignal.timeout(25000) });
    hlsDebug.manifest_status = m3u8Res.status;
    hlsDebug.manifest_type   = m3u8Res.headers.get('content-type');

    if (!m3u8Res.ok) {
      hlsDebug.manifest_body = await m3u8Res.text().catch(() => '');
      return { buffer: null, method: '', debug };
    }

    const m3u8Text = await m3u8Res.text();
    hlsDebug.manifest_lines = m3u8Text.split('\n').length;

    const lines = m3u8Text.split('\n').map(l => l.trim()).filter(Boolean);
    let segmentUrl: string | null = null;

    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const resolved = line.startsWith('http') ? line : new URL(line, hlsUrl).href;

      if (line.endsWith('.m3u8') || line.includes('.m3u8?')) {
        // Master → variant playlist
        const varRes  = await fetch(resolved, { headers: hlsHeaders, signal: AbortSignal.timeout(20000) });
        const varText = varRes.ok ? await varRes.text() : '';
        hlsDebug.variant_status = varRes.status;
        const varLines = varText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        hlsDebug.variant_segments = varLines.length;
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

    hlsDebug.segment_url = segmentUrl ? segmentUrl.slice(0, 80) + '…' : null;
    if (!segmentUrl) return { buffer: null, method: '', debug };

    const tsRes = await fetch(segmentUrl, { headers: tsHeaders, signal: AbortSignal.timeout(25000) });
    hlsDebug.segment_status = tsRes.status;
    hlsDebug.segment_type   = tsRes.headers.get('content-type');

    if (!tsRes.ok) return { buffer: null, method: '', debug };

    const tsBuffer = Buffer.from(await tsRes.arrayBuffer());
    hlsDebug.segment_bytes = tsBuffer.length;

    // First: scan for embedded JPEG (MJPEG cameras embed SOI markers in PES)
    let jpegStart = -1;
    for (let i = 0; i < tsBuffer.length - 2; i++) {
      if (tsBuffer[i] === 0xFF && tsBuffer[i + 1] === 0xD8 && tsBuffer[i + 2] === 0xFF) {
        jpegStart = i; break;
      }
    }
    hlsDebug.jpeg_found = jpegStart >= 0;

    if (jpegStart >= 0) {
      let jpegEnd = tsBuffer.length;
      for (let i = jpegStart + 2; i < tsBuffer.length - 1; i++) {
        if (tsBuffer[i] === 0xFF && tsBuffer[i + 1] === 0xD9) { jpegEnd = i + 2; break; }
      }
      const buf = tsBuffer.slice(jpegStart, jpegEnd);
      return { buffer: buf, method: 'hls-segment-mjpeg', debug };
    }

    // H.264 camera — use ffmpeg to decode the first frame
    console.log(`[een-image] No embedded JPEG in ${tsBuffer.length}B .ts — using ffmpeg`);
    const ffJpeg = await extractJpegViaFfmpeg(tsBuffer, hlsDebug);
    if (ffJpeg) {
      return { buffer: ffJpeg, method: 'hls-ffmpeg', debug };
    }

  } catch (err: any) {
    debug.hls_error = err.message;
    console.warn(`[een-image] fetchEenCameraImage error: ${err.message}`);
  }

  return { buffer: null, method: '', debug };
}
