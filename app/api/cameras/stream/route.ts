// app/api/cameras/stream/route.ts
//
// Returns a live HLS stream URL + auth token for a given camera.
// Called by SmartVideoPlayer to bootstrap the cookie-proxied HLS session.
//
// Old pattern: read credentials from NEXT_PUBLIC_SITE_CONFIG env var.
// New pattern: use getValidEENToken(accountId) — Supabase-backed, auto-refreshes.
//
// Request body:
//   { accountId: string, cameraId: string, source?: 'een' | 'brivo' }
//   (accountId also accepted as siteId for backwards compatibility)
//
// Response:
//   { token: string, hlsUrl: string }
//
// The client then:
//   1. POSTs token to /api/cameras/set-cookie
//   2. Proxies HLS requests through /api/cameras/proxy with withCredentials:true

import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Accept both field names for backwards compatibility
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

    // Fetch the live HLS feed URL from EEN
    const url = `https://${cluster}/api/v3.0/feeds?deviceId=${cameraId}&include=hlsUrl`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    const response = await fetch(url, { method: 'GET', headers });
    const data     = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message ?? `EEN feeds error ${response.status}` },
        { status: response.status }
      );
    }

    const results: any[]  = data.results ?? [];
    const streamData      = results.find((feed: any) => feed.hlsUrl);

    if (!streamData?.hlsUrl) {
      return NextResponse.json(
        { error: 'No HLS stream URL found for this camera. Camera may be offline.' },
        { status: 404 }
      );
    }

    // Return token + hlsUrl — SmartVideoPlayer sets token as cookie,
    // then proxies HLS segment requests through /api/cameras/proxy
    return NextResponse.json({ token, hlsUrl: streamData.hlsUrl });

  } catch (err: any) {
    console.error('[cameras/stream] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
