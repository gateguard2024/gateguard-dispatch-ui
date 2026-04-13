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

    // 1. Ask the V3 Feeds API for the live Preview Stream (MJPEG)
    const feedUrl = `${baseUrl}/api/v3.0/feeds?deviceId=${cameraId}&type=preview&include=multipartUrl`;
    const feedRes = await fetch(feedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!feedRes.ok) {
      return new NextResponse(`EEN Feeds API Error: ${feedRes.status}`, { status: feedRes.status });
    }

    const feedData = await feedRes.json();
    const previewFeed = feedData.results?.find((r: any) => r.type === 'preview');
    
    if (previewFeed && previewFeed.multipartUrl) {
      // 2. Redirect the frontend <img> tag directly to the live Eagle Eye stream!
      // This bypasses CORS automatically and saves Vercel bandwidth.
      return NextResponse.redirect(previewFeed.multipartUrl);
    } else {
      return new NextResponse('No preview URL found for this camera', { status: 404 });
    }
  } catch (error) {
    console.error("Image proxy failed:", error);
    return new NextResponse('Image proxy crashed', { status: 500 });
  }
}
