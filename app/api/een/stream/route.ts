// app/api/een/stream/route.ts
//
// Returns the HLS streaming URL for a live camera feed.
//
// Old pattern: read cluster from NEXT_PUBLIC_SITE_CONFIG, accept token in body.
// New pattern: look up token via getValidEENToken(accountId) — Supabase-backed,
//              handles automatic refresh.
//
// Request body:
//   { accountId: string, cameraId: string }
//   (accountId also accepted as siteId for backwards compatibility)

import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Accept both field names
    const accountId: string | undefined = body.accountId ?? body.siteId;
    const cameraId:  string | undefined = body.cameraId;

    if (!accountId || !cameraId) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId (or siteId) and cameraId' },
        { status: 400 }
      );
    }

    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!cluster || !token) {
      return NextResponse.json(
        { error: 'EEN not authenticated for this account. Re-run OAuth in Setup.' },
        { status: 400 }
      );
    }

    const url = `https://${cluster}/api/v3.0/feeds?deviceId=${cameraId}&include=hlsUrl`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    const response = await fetch(url, { method: 'GET', headers });
    const data     = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const results: any[]   = data.results ?? [];
    const streamData       = results.find((feed: any) => feed.hlsUrl);

    if (!streamData?.hlsUrl) {
      return NextResponse.json(
        { error: 'HLS stream URL missing in EEN response', data },
        { status: 404 }
      );
    }

    return NextResponse.json({ url: streamData.hlsUrl });

  } catch (err: any) {
    console.error('[een/stream] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
