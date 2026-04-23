// app/api/een/recorded/route.ts
//
// Returns a time-bounded HLS recording URL for a given EEN camera.
//
// EEN V3 Media API:
//   GET /api/v3.0/media
//   Required params: deviceId, type (main|preview), mediaType (video|image),
//                    startTimestamp__gte, endTimestamp__lte
//   Response: { results: [{ hlsUrl, mp4Url, startTimestamp, endTimestamp, ... }] }
//
// TIMESTAMP FORMAT: Use epoch milliseconds (Unix ms integers), NOT ISO strings.
// ISO strings cause encoding problems: colons (%3A) and '+' in '+00:00' (%2B / space).
// Confirmed via Postman — EEN accepts epoch ms and returns correct results.
//
// The hlsUrl from the first result is returned directly to SmartVideoPlayer.
//
// Request body:
//   { accountId: string, cameraId: string, startTime: ISO string, endTime: ISO string }

import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const accountId: string | undefined = body.accountId ?? body.siteId;
    const cameraId:  string | undefined = body.cameraId;
    const startTime: string | undefined = body.startTime;
    const endTime:   string | undefined = body.endTime;

    if (!accountId || !cameraId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, cameraId, startTime, endTime' },
        { status: 400 }
      );
    }

    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!cluster || !token) {
      return NextResponse.json(
        { error: 'EEN not authenticated for this account.' },
        { status: 400 }
      );
    }

    // EEN media endpoint requires ISO 8601 string — epoch ms returns 400 "wrong type".
    // Two encoding rules (both required):
    //   1. Colons in the time part must stay RAW — EEN rejects %3A encoding
    //   2. The '+' in '+00:00' MUST be encoded as %2B
    //      A raw '+' in a query string is interpreted as a space by HTTP,
    //      so EEN would receive '...T14:30:00.000 00:00' — a parse failure.
    // Final form sent to EEN: 2026-04-22T14:30:00.000%2B00:00
    const encodeTs = (iso: string) =>
      iso.replace(/Z$/, '+00:00').replace(/\+/g, '%2B');

    const startIso = encodeTs(new Date(startTime).toISOString());
    const endIso   = encodeTs(new Date(endTime).toISOString());

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    // ── Query EEN media list ──────────────────────────────────────────────────
    // Build URL manually — do NOT use URLSearchParams (it encodes ':' as %3A)
    const mediaUrl = [
      `https://${cluster}/api/v3.0/media`,
      `?deviceId=${encodeURIComponent(cameraId)}`,
      `&type=main`,
      `&mediaType=video`,
      `&startTimestamp__gte=${startIso}`,
      `&endTimestamp__lte=${endIso}`,
      `&pageSize=10`,
    ].join('');
    console.log(`[een/recorded] Querying: ${mediaUrl}`);

    const res      = await fetch(mediaUrl, { method: 'GET', headers });
    const resText  = await res.text();
    console.log(`[een/recorded] EEN status: ${res.status} | body: ${resText.slice(0, 500)}`);

    if (!res.ok) {
      return NextResponse.json(
        { error: `EEN media error ${res.status}: ${resText}` },
        { status: res.status }
      );
    }

    const data     = JSON.parse(resText);
    const clips: any[] = data.results ?? [];

    if (clips.length === 0) {
      return NextResponse.json(
        { error: 'No recording found for the selected time range. The camera may not have been recording during this window.' },
        { status: 404 }
      );
    }

    // Log the full first clip so we can see what field names EEN actually uses
    const firstClip = clips[0];
    console.log(`[een/recorded] First clip keys: ${Object.keys(firstClip).join(', ')}`);
    console.log(`[een/recorded] First clip: ${JSON.stringify(firstClip).slice(0, 800)}`);

    // Try all known EEN field names for the HLS URL
    const hlsUrl =
      firstClip.hlsUrl         ??  // V3 standard
      firstClip.hlsPlaybackUrl ??  // alternate V3
      firstClip.playbackUrl    ??  // possible alias
      firstClip.streamUrl      ??  // possible alias
      firstClip.mp4Url         ??  // fallback to MP4
      firstClip.downloadUrl    ??  // last resort download
      null;

    if (!hlsUrl) {
      // Return the full clip object so we can see what fields are available
      console.error(`[een/recorded] No URL found. Full clip: ${JSON.stringify(firstClip)}`);
      return NextResponse.json(
        {
          error: 'EEN returned a clip but no playback URL was found.',
          clipKeys: Object.keys(firstClip),
          clip: firstClip,   // expose to client for debugging
        },
        { status: 404 }
      );
    }

    console.log(`[een/recorded] Returning URL for ${clips.length} clip(s): ${hlsUrl}`);

    return NextResponse.json({ url: hlsUrl, token, clipCount: clips.length });

  } catch (err: any) {
    console.error('[een/recorded] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
