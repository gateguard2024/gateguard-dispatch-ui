// app/api/een/proxy/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const token = searchParams.get('token');

  if (!targetUrl || !token) {
    return new NextResponse('Missing URL or token', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
        // EEN sometimes requires specific cookies for media streams, 
        // but the Bearer token usually suffices for the initial manifest.
      }
    });

    if (!response.ok) {
      return new NextResponse(`EEN Stream Error: ${response.status}`, { status: response.status });
    }

    // We stream the exact media content back to the frontend
    const stream = response.body;
    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';

    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType,
        // These headers explicitly tell the browser to allow the video player to read the file
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    return new NextResponse('Stream proxy failed', { status: 500 });
  }
}
