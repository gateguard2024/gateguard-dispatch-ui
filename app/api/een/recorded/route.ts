// app/api/een/recorded/route.ts
//
// Returns a time-bounded HLS recording URL for a given EEN camera.
//
// EEN V3 Media API:
//   GET /api/v3.0/media
//   Required params: deviceId, type (preview|main), mediaType (video|image),
//                    startTimestamp__gte, endTimestamp__lte
//   Response: { results: [{ hlsUrl, mp4Url, startTimestamp, endTimestamp, ... }] }
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

    // EEN requires +00:00 format NOT Z — e.g. 2026-04-22T14:30:00.000+00:00
    const startIso = new Date(startTime).toISOString().replace(/Z$/, '+00:00');
    const endIso   = new Date(endTime).toISOString().replace(/Z$/, '+00:00');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    // ── Query EEN media list ──────────────────────────────────────────────────
    // NOTE: Do NOT use URLSearchParams — it encodes colons in timestamps as %3A
    // which EEN rejects. Build the query string manually with raw ISO timestamps.
    const mediaUrl = [
      `https://${cluster}/api/v3.0/media`,
      `?deviceId=${encodeURIComponent(cameraId)}`,
      `&type=preview`,
      `&mediaType=video`,
      `&startTimestamp__gte=${startIso}`,   // raw ISO — colons must not be encoded
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

    // Use the hlsUrl from the first clip — this is the pre-authenticated
    // HLS manifest URL for the recorded segment
    const hlsUrl = clips[0].hlsUrl ?? clips[0].mp4Url ?? null;

    if (!hlsUrl) {
      return NextResponse.json(
        { error: 'EEN returned a clip but no HLS URL was available. The recording may still be processing.' },
        { status: 404 }
      );
    }

    console.log(`[een/recorded] Returning HLS URL for ${clips.length} clip(s): ${hlsUrl}`);

    return NextResponse.json({ url: hlsUrl, token, clipCount: clips.length });

  } catch (err: any) {
    console.error('[een/recorded] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
