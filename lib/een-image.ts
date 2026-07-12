// lib/een-image.ts
//
// Fetches a JPEG frame from an EEN camera using the best available method.
//
// Strategy (in priority order — all documented in EEN V3 API):
//
//   1. GET /api/v3.0/cameras/{esn}/image
//        Standard EEN still-image endpoint. Works on most cameras; 404 on some models.
//        https://developer.eagleeyenetworks.com/docs/cameras
//
//   2. GET /api/v3.0/media/recordedImage.jpeg?deviceId={esn}&timestamp__lte={now}
//        Added in June 2025 update. Returns the most recent recorded JPEG frame
//        from the API cluster (NOT the media server — same auth as all other API calls).
//        https://developer.eagleeyenetworks.com/changelog/20250612-api-updates
//
//   3. Preview MJPEG multipart stream (/feeds?include=multipartUrl, type=preview)
//        EEN docs: "All supported cameras can provide both the main and preview
//        video feeds. The preview video is a JPEG-based lower quality video stream."
//        We open the multipartUrl, read chunks until we have one complete JPEG, then abort.
//        https://developer.eagleeyenetworks.com/docs/watch-live-video
//
//   4. HLS main stream + ffmpeg frame extraction (last resort)
//        Downloads the first .ts segment (H.264 MPEG-TS) and pipes it through ffmpeg-static.
//        Used only if preview MJPEG stream is unavailable.
//        https://developer.eagleeyenetworks.com/docs/testing-ffmpeg
//
// Returns { buffer: Buffer | null, method: string, debug: Record<string,any> }

import { spawn } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string | null = require('ffmpeg-static');

export interface EenImageResult {
  buffer: Buffer | null;
  method: string;
  debug:  Record<string, any>;
}

// ─── Strategy 4 helper: ffmpeg frame from H.264 MPEG-TS ───────────────────────
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
      '-q:v',     '2',         // quality: 2 = high (1–31 scale)
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

// ─── Strategy 3 helper: single JPEG from MJPEG multipart stream ───────────────
// EEN preview feeds are live MJPEG multipart streams (multipart/x-mixed-replace).
// Each boundary part is a JPEG frame. We read chunks until we find SOI→EOI, then abort.
async function extractJpegFromMultipart(
  url:     string,
  headers: Record<string, string>,
  debug:   Record<string, any>,
): Promise<Buffer | null> {
  const controller = new AbortController();
  // 12s covers the worst-case preview interval (max is 16s per EEN docs, typical is 1s)
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    debug.preview_status       = res.status;
    debug.preview_content_type = res.headers.get('content-type');

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      return null;
    }

    const reader = res.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes    = 0;
    let jpegStartGlobal = -1; // byte offset in the concatenated buffer

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = Buffer.from(value);
      chunks.push(chunk);
      totalBytes += chunk.length;

      // Rebuild accumulated buffer (cheap for small JPEG preview frames)
      const buf = Buffer.concat(chunks);

      // Find JPEG SOI (FF D8 FF)
      if (jpegStartGlobal === -1) {
        for (let i = 0; i < buf.length - 2; i++) {
          if (buf[i] === 0xFF && buf[i + 1] === 0xD8 && buf[i + 2] === 0xFF) {
            jpegStartGlobal = i;
            break;
          }
        }
      }

      // Find JPEG EOI (FF D9) once SOI is known
      if (jpegStartGlobal >= 0) {
        for (let i = jpegStartGlobal + 2; i < buf.length - 1; i++) {
          if (buf[i] === 0xFF && buf[i + 1] === 0xD9) {
            controller.abort(); // stop the multipart stream
            clearTimeout(timer);
            const jpeg = buf.slice(jpegStartGlobal, i + 2);
            debug.preview_total_bytes = totalBytes;
            debug.preview_jpeg_bytes  = jpeg.length;
            console.log(`[een-image] ✓ MJPEG preview frame: ${jpeg.length}B (from ${totalBytes}B streamed)`);
            return jpeg;
          }
        }
      }

      if (totalBytes > 3_000_000) {
        debug.preview_error = 'Exceeded 3MB without finding a complete JPEG';
        break;
      }
    }

    clearTimeout(timer);
    debug.preview_error ??= `Stream ended with ${totalBytes}B — no complete JPEG found`;
    return null;
  } catch (err: any) {
    clearTimeout(timer);
    // AbortError is expected when we abort after finding our JPEG — not a real error
    if (err.name !== 'AbortError') {
      debug.preview_error = err.message;
    }
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Attempt to pull a JPEG snapshot from an EEN camera.
 * Tries 4 progressively more complex methods, returning as soon as one succeeds.
 *
 * @param esn     EEN camera ID (ESN, e.g. "10072f05")
 * @param cluster EEN API cluster host (e.g. "api.c031.eagleeyenetworks.com")
 * @param token   Valid EEN bearer token
 * @param apiKey  Optional EEN x-api-key header value
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
  const mediaBase  = `https://${cluster}/api/v3.0/media`;

  // ── Strategy 1: Standard /cameras/{esn}/image ─────────────────────────────
  // Fast (3s timeout). Works on most cameras; some older models return 404.
  for (const url of [
    `${baseUrl}/image`,
    `${baseUrl}/image?timestamp=${new Date().toISOString()}`,
    `${baseUrl}/image?type=preview`,
  ]) {
    try {
      const r = await fetch(url, { headers: imgHeaders, signal: AbortSignal.timeout(3000) });
      debug[`s1_${r.status}`] = url;
      if (r.ok && r.headers.get('content-type')?.includes('image')) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
          console.log(`[een-image] ✓ Strategy 1 still-image: ${buf.length}B`);
          return { buffer: buf, method: 'still-image', debug };
        }
        debug.s1_not_jpeg = true;
      }
    } catch {
      // timeout or network error — try next variant
    }
  }

  // ── Strategy 2: /media/recordedImage.jpeg (June 2025 API endpoint) ────────
  // Returns the most recent recorded JPEG frame from the API cluster directly.
  // Uses the same auth as all other API calls — no media cookie needed.
  // Docs: https://developer.eagleeyenetworks.com/changelog/20250612-api-updates
  try {
    const nowIso = encodeURIComponent(new Date().toISOString());
    const recUrl = `${mediaBase}/recordedImage.jpeg?deviceId=${esnEncoded}&timestamp__lte=${nowIso}`;
    debug.s2_url = recUrl;

    const r = await fetch(recUrl, { headers: imgHeaders, signal: AbortSignal.timeout(8000) });
    debug.s2_status      = r.status;
    debug.s2_content_type = r.headers.get('content-type');

    if (r.ok && r.headers.get('content-type')?.includes('image')) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
        console.log(`[een-image] ✓ Strategy 2 recordedImage.jpeg: ${buf.length}B`);
        return { buffer: buf, method: 'recorded-image-api', debug };
      }
      debug.s2_not_jpeg = true;
    }
  } catch (e: any) {
    debug.s2_error = e.message;
  }

  // ── Strategy 3: Preview MJPEG multipart stream ────────────────────────────
  // EEN: "All supported cameras can provide both the main and preview video feeds.
  // The preview video is a JPEG-based lower quality video stream."
  // We request multipartUrl for the preview feed and read until we get one JPEG.
  const feedsDebug: Record<string, any> = {};
  debug.feeds = feedsDebug;

  try {
    const feedsUrl = `https://${cluster}/api/v3.0/feeds?deviceId=${esnEncoded}&include=hlsUrl,multipartUrl`;
    const feedsRes = await fetch(feedsUrl, { headers: jsonHeaders, signal: AbortSignal.timeout(8000) });
    feedsDebug.status     = feedsRes.status;

    const feedsData = feedsRes.ok ? await feedsRes.json() : null;
    const results   = (feedsData?.results ?? []) as Array<{
      id: string; type: string; deviceId: string;
      hlsUrl?: string; multipartUrl?: string;
    }>;
    feedsDebug.feed_count = results.length;
    feedsDebug.feed_types = results.map(f => f.type);

    const previewFeed = results.find(f => f.type === 'preview' && f.multipartUrl);
    feedsDebug.preview_url = previewFeed?.multipartUrl?.slice(0, 80) + '…' || null;

    if (previewFeed?.multipartUrl) {
      const mpHeaders = {
        ...authHeader,
        Accept: 'multipart/x-mixed-replace, image/jpeg, */*',
      };
      const jpeg = await extractJpegFromMultipart(previewFeed.multipartUrl, mpHeaders, feedsDebug);
      if (jpeg) {
        return { buffer: jpeg, method: 'preview-mjpeg', debug };
      }
    } else {
      feedsDebug.preview_missing = 'No preview feed with multipartUrl in feeds response';
    }

    // ── Strategy 4: HLS main stream + ffmpeg ──────────────────────────────────
    // Last resort — download the first .ts segment and pipe through ffmpeg-static
    // to extract a single JPEG frame from the H.264 bitstream.
    const mainFeed = results.find(f => f.hlsUrl);
    feedsDebug.hls_url = mainFeed?.hlsUrl?.slice(0, 80) + '…' || null;

    if (!mainFeed?.hlsUrl) {
      console.warn('[een-image] No feeds available for image extraction');
      return { buffer: null, method: '', debug };
    }

    const hlsUrl     = mainFeed.hlsUrl;
    const hlsHeaders = { ...authHeader, Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' };
    const tsHeaders  = { ...authHeader, Accept: 'video/MP2T, */*' };

    const m3u8Res = await fetch(hlsUrl, { headers: hlsHeaders, signal: AbortSignal.timeout(25000) });
    feedsDebug.manifest_status = m3u8Res.status;
    feedsDebug.manifest_type   = m3u8Res.headers.get('content-type');

    if (!m3u8Res.ok) {
      feedsDebug.manifest_body = await m3u8Res.text().catch(() => '');
      return { buffer: null, method: '', debug };
    }

    const m3u8Text = await m3u8Res.text();
    feedsDebug.manifest_lines = m3u8Text.split('\n').length;

    const lines = m3u8Text.split('\n').map(l => l.trim()).filter(Boolean);
    let segmentUrl: string | null = null;

    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const resolved = line.startsWith('http') ? line : new URL(line, hlsUrl).href;

      if (line.endsWith('.m3u8') || line.includes('.m3u8?')) {
        const varRes  = await fetch(resolved, { headers: hlsHeaders, signal: AbortSignal.timeout(20000) });
        const varText = varRes.ok ? await varRes.text() : '';
        feedsDebug.variant_status = varRes.status;
        const varSegs = varText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        feedsDebug.variant_segments = varSegs.length;
        if (varSegs[0]) {
          segmentUrl = varSegs[0].startsWith('http') ? varSegs[0] : new URL(varSegs[0], resolved).href;
        }
        break;
      }
      if (line.endsWith('.ts') || line.includes('.ts?')) {
        segmentUrl = resolved;
        break;
      }
    }

    feedsDebug.segment_url = segmentUrl ? segmentUrl.slice(0, 80) + '…' : null;
    if (!segmentUrl) return { buffer: null, method: '', debug };

    const tsRes = await fetch(segmentUrl, { headers: tsHeaders, signal: AbortSignal.timeout(25000) });
    feedsDebug.segment_status = tsRes.status;
    feedsDebug.segment_type   = tsRes.headers.get('content-type');
    if (!tsRes.ok) return { buffer: null, method: '', debug };

    const tsBuffer = Buffer.from(await tsRes.arrayBuffer());
    feedsDebug.segment_bytes = tsBuffer.length;

    // Scan for embedded JPEG SOI (FF D8 FF) — present only in MJPEG cameras
    let jpegStart = -1;
    for (let i = 0; i < tsBuffer.length - 2; i++) {
      if (tsBuffer[i] === 0xFF && tsBuffer[i + 1] === 0xD8 && tsBuffer[i + 2] === 0xFF) {
        jpegStart = i; break;
      }
    }
    feedsDebug.ts_jpeg_found = jpegStart >= 0;

    if (jpegStart >= 0) {
      let jpegEnd = tsBuffer.length;
      for (let i = jpegStart + 2; i < tsBuffer.length - 1; i++) {
        if (tsBuffer[i] === 0xFF && tsBuffer[i + 1] === 0xD9) { jpegEnd = i + 2; break; }
      }
      console.log(`[een-image] ✓ Strategy 4a MJPEG-in-TS: extracted ${jpegEnd - jpegStart}B`);
      return { buffer: tsBuffer.slice(jpegStart, jpegEnd), method: 'hls-mjpeg', debug };
    }

    // H.264 camera — pipe through ffmpeg to decode first frame
    console.log(`[een-image] H.264 segment (${tsBuffer.length}B) → ffmpeg`);
    const ffJpeg = await extractJpegViaFfmpeg(tsBuffer, feedsDebug);
    if (ffJpeg) {
      console.log(`[een-image] ✓ Strategy 4b ffmpeg: ${ffJpeg.length}B`);
      return { buffer: ffJpeg, method: 'hls-ffmpeg', debug };
    }

  } catch (err: any) {
    debug.feeds_error = err.message;
    console.warn(`[een-image] fetchEenCameraImage error: ${err.message}`);
  }

  return { buffer: null, method: '', debug };
}
