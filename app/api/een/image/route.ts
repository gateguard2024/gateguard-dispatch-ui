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
    const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
    const config = SITES.find((s: any) => s.siteName === siteName);
    
    let baseUrl = config ? config.cluster.trim() : "https://media.c031.eagleeyenetworks.com";
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // Use the extremely reliable V2 Image API and pass the token as a URL param
    // We add a random cache_buster so the browser doesn't load a stale image
    const timestamp = new Date().getTime();
    const targetUrl = `${baseUrl}/api/v2.0/cameras/${cameraId}/image?access_token=${token}&c=${timestamp}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/jpeg'
      },
      // Ensure Vercel never caches this response
      cache: 'no-store'
    });

    if (!response.ok) {
        return new NextResponse(`EEN API Error: ${response.status}`, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=10', // Cache in browser for 10 seconds to prevent flickering
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error("Image proxy failed:", error);
    return new NextResponse('Image proxy crashed', { status: 500 });
  }
}
