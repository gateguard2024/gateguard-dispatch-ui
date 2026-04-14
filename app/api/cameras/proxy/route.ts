// app/api/cameras/proxy/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // 1. Grab the target URL and Token from the query string
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const token = request.headers.get('authorization')?.split('Bearer ')[1];

    if (!targetUrl || !token) {
      return new NextResponse("Missing URL or Token", { status: 400 });
    }

    // 2. The Server fetches the stream (Servers ignore CORS!)
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stream chunk: ${response.status}`);
    }

    // 3. We pass the raw video data straight back to the browser
    const data = await response.arrayBuffer();
    
    // We have to copy EEN's content type so the video player knows what it is receiving
    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        // We tell the browser: "Yes, you are allowed to read this!"
        'Access-Control-Allow-Origin': '*', 
      },
    });

  } catch (error: any) {
    console.error("Proxy Error:", error);
    return new NextResponse("Proxy Error", { status: 500 });
  }
}
