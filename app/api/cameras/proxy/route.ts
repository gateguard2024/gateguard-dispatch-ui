import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    // Pull the massive token securely out of the cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('een_stream_token')?.value;

    if (!targetUrl || !token) {
      return new NextResponse("Missing URL or Token", { status: 400 });
    }

    const response = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      return new NextResponse(`EEN Proxy Error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';

    // ==========================================
    // 🧠 PLAYLIST REWRITING
    // ==========================================
    if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8') || targetUrl.includes('getPlaylist')) {
      const text = await response.text();
      const lines = text.split('\n');

      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // 🚨 BULLETPROOF PATHING: Let JS cleanly resolve the relative path based on the current targetUrl
          const absoluteChunkUrl = new URL(trimmed, targetUrl).toString();
          
          // Route the chunk back through our Vercel Proxy
          return `/api/cameras/proxy?url=${encodeURIComponent(absoluteChunkUrl)}`;
        }
        return trimmed;
      });

      return new NextResponse(rewrittenLines.join('\n'), {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
      });
    }

    // ==========================================
    // 📼 BINARY CHUNKS
    // ==========================================
    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      headers: { 
        'Content-Type': contentType || 'video/MP2T',
        'Cache-Control': 'no-store' // Do not cache live video frames
      },
    });

  } catch (error: any) {
    console.error("Proxy Error:", error);
    return new NextResponse("Proxy Server Error", { status: 500 });
  }
}
