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

    // Request the HLS stream for the specific camera
    const response = await fetch(`${baseUrl}/api/v3.0/cameras/${cameraId}/video`, {
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

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Proxy Error' }, { status: 500 });
  }
}
