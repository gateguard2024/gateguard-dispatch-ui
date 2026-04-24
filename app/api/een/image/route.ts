// app/api/een/image/route.ts
//
// Proxies a camera snapshot from EEN back to the browser.
//
// Old pattern: read cluster + token from NEXT_PUBLIC_SITE_CONFIG env var.
// New pattern: look up token via getValidEENToken(accountId) — Supabase-backed,
//              handles automatic refresh.
//
// Query params:
//   cameraId  — EEN device ESN
//   accountId — Supabase accounts.id (UUID)

import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cameraId  = searchParams.get('cameraId');
  const accountId = searchParams.get('accountId');

  if (!cameraId || !accountId) {
    return NextResponse.json(
      { error: 'Missing required params: cameraId and accountId' },
      { status: 400 }
    );
  }

  try {
    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!cluster || !token) {
      return NextResponse.json(
        { error: 'EEN not authenticated for this account. Re-run OAuth in Setup.' },
        { status: 400 }
      );
    }

    // EEN V3 camera snapshot — try the standard cameras image endpoint.
    // Falls back gracefully via onError in the img tag if EEN returns 404.
    const targetUrl = `https://${cluster}/api/v3.0/cameras/${encodeURIComponent(cameraId)}/image`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        'image/jpeg',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    const response = await fetch(targetUrl, {
      method:  'GET',
      headers,
      cache:   'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `EEN API Error: ${response.status}`, targetUrl },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type':                'image/jpeg',
        'Cache-Control':               'public, max-age=10',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err: any) {
    console.error('[een/image] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
