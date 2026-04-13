// app/api/een/stream/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token, siteName, cameraId } = await request.json();
    const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
    const config = SITES.find((s: any) => s.siteName === siteName);
    
    if (!config) return NextResponse.json({ error: 'Config not found' }, { status: 400 });

    let baseUrl = config.cluster.trim();
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // EEN V3 live video feed endpoint. We ask for the "main" high-quality stream 
    // and explicitly tell it to include the "hlsUrl" in the response.
    const url = `${baseUrl}/api/v3.0/feeds?deviceId=${cameraId}&include=hlsUrl`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // The API returns an array of results. We need to find the one that has the hlsUrl.
    const results = data.results || [];
    const streamData = results.find((feed: any) => feed.hlsUrl);

    if (!streamData || !streamData.hlsUrl) {
       return NextResponse.json({ error: 'HLS stream URL missing in EEN response', data }, { status: 404 });
    }

    // Return the actual HLS streaming URL back to the Alarms page
    return NextResponse.json({ url: streamData.hlsUrl });
    
  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json({ error: 'Internal Server Proxy Error' }, { status: 500 });
  }
}
