// app/api/een/image/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cameraId = searchParams.get('cameraId');
  const siteName = searchParams.get('siteName');
  const token = searchParams.get('token');

  if (!cameraId || !siteName || !token) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
    const config = SITES.find((s: any) => s.siteName === siteName);
    
    let baseUrl = config ? config.cluster.trim() : "https://media.c031.eagleeyenetworks.com";
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // Let's try the "/preview" endpoint which is standard in many V3 systems
    const targetUrl = `${baseUrl}/api/v3.0/cameras/${cameraId}/preview`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'image/jpeg'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      // If EEN rejects it, we return a JSON error so we can read it in the browser!
      const errorText = await response.text();
      return NextResponse.json({ 
        proxy_error: "Eagle Eye rejected the request",
        een_status: response.status,
        een_message: errorText,
        url_tried: targetUrl
      }, { status: 404 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=5',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Image proxy crashed' }, { status: 500 });
  }
}
