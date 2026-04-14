// app/api/cameras/stream/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const { siteId, cameraId } = await request.json();
    if (!siteId || !cameraId) throw new Error("Missing siteId or cameraId");

    // 1. Get the active token and cluster for this site
    const { token, cluster } = await getValidEENToken(siteId);

    // 2. Ask EEN V3 for the HLS live feed URL
    const response = await fetch(`https://${cluster}/api/v3.0/feeds?deviceId=${cameraId}&include=hlsUrl`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Failed to get EEN stream");

    const data = await response.json();
    
    // The API returns an array of results. We want the HLS URL.
    const hlsUrl = data.results?.[0]?.hlsUrl;
    if (!hlsUrl) throw new Error("No HLS stream available for this camera");

    // 3. Return BOTH the URL and the Token
    return NextResponse.json({ hlsUrl, token });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
