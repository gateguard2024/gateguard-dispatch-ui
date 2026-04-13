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

    // EEN V3 API endpoint for retrieving the live HLS stream URL
    const response = await fetch(`${baseUrl}/api/v3.0/cameras/${cameraId}/streams/primary`, {
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

    // EEN sometimes returns the URL inside different properties based on the cluster.
    // We will extract it safely.
    const streamUrl = data.url || (data.data && data.data.url) || data.streamUrl;

    if (!streamUrl) {
       return NextResponse.json({ error: 'Stream URL missing in EEN response', data }, { status: 404 });
    }

    return NextResponse.json({ url: streamUrl });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Proxy Error' }, { status: 500 });
  }
}
