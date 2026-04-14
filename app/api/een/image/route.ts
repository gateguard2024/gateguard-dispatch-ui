import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cameraId = searchParams.get('cameraId');
  const siteName = searchParams.get('siteName');
  const token = searchParams.get('token');

  if (!cameraId || !siteName || !token) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
    const config = SITES.find((s: any) => s.siteName === siteName);
    
    let baseUrl = config ? config.cluster.trim() : "https://media.c031.eagleeyenetworks.com";
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // EXACT V3 Endpoint (Singular 'image')
    const targetUrl = `${baseUrl}/api/v3.0/cameras/${cameraId}/image`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'image/jpeg'
      },
      cache: 'no-store' // Never cache at the edge
    });

    if (!response.ok) {
        return NextResponse.json({ error: `EEN API Error: ${response.status}`, targetUrl }, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=10', // Cache in browser for 10s to prevent spamming EEN
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error("Image proxy failed:", error);
    return NextResponse.json({ error: 'Proxy crashed' }, { status: 500 });
  }
}
