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

    // This is the V3 way to request a single JPEG snapshot from a camera
    const targetUrl = `${baseUrl}/api/v3.0/cameras/${cameraId}/images`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'image/jpeg'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("EEN V3 Image Fetch Failed:", response.status, errorText);
        return new NextResponse(`EEN V3 API Error: ${response.status}`, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=10', // Cache in browser for 10 seconds
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error("Image proxy failed:", error);
    return new NextResponse('Image proxy crashed', { status: 500 });
  }
}
