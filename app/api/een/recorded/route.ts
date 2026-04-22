// app/api/een/recorded/route.ts
//
// Returns a time-bounded HLS recording URL for a given EEN camera.
//
// EEN V3 recorded media endpoint:
//   GET /api/v3.0/media.m3u8?deviceId={esn}&startTimestamp={iso}&endTimestamp={iso}
//
// The returned URL is an HLS manifest (.m3u8) that SmartVideoPlayer can load directly.
// No separate proxy needed — the manifest URL is pre-authenticated by EEN.
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

    // Build the EEN recorded media URL
    // EEN V3 uses ISO 8601 timestamps for startTimestamp and endTimestamp
    const params = new URLSearchParams({
      deviceId:       cameraId,
      startTimestamp: new Date(startTime).toISOString(),
      endTimestamp:   new Date(endTime).toISOString(),
      type:           'preview',  // 'preview' = lower res, faster; 'main' = full quality
    });

    const mediaUrl = `https://${cluster}/api/v3.0/media.m3u8?${params.toString()}`;

    // Verify the clip exists by checking the EEN response
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        'application/vnd.apple.mpegurl',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    const eenRes = await fetch(mediaUrl, { method: 'GET', headers });

    if (!eenRes.ok) {
      if (eenRes.status === 404) {
        return NextResponse.json(
          { error: 'No recording found for the selected time range. The camera may not have been recording.' },
          { status: 404 }
        );
      }
      const errText = await eenRes.text();
      throw new Error(`EEN recorded media error ${eenRes.status}: ${errText}`);
    }

    // Return the URL — SmartVideoPlayer loads it via HLS.js
    // We pass the token so the player can auth requests if needed
    return NextResponse.json({ url: mediaUrl, token });

  } catch (err: any) {
    console.error('[een/recorded] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
