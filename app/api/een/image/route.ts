// app/api/een/image/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cameraId = searchParams.get('cameraId');
  const siteName = searchParams.get('siteName');
  const token = searchParams.get('token');

  if (!cameraId || !siteName || !token) {
    return new NextResponse('Missing required parameters', { status: 400 });
  }

  try {
    // 1. Get the cluster URL for this specific site
    const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
    const config = SITES.find((s: any) => s.siteName === siteName);
    
    let baseUrl = config ? config.cluster.trim() : "https://media.c031.eagleeyenetworks.com";
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // 2. Ask EEN for the current camera snapshot
    const response = await fetch(`${baseUrl}/api/v3.0/cameras/${cameraId}/image`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      // We don't want Vercel to permanently cache an old image
      cache: 'no-store'
    });

    if (!response.ok) {
      return new NextResponse(`EEN Image Error: ${response.status}`, { status: response.status });
    }

    // 3. Return the raw binary image data back to the frontend
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=5', // Cache in the browser for 5 seconds
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error("Image proxy failed:", error);
    return new NextResponse('Image proxy failed', { status: 500 });
  }
}
