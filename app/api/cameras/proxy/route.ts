// app/api/cameras/proxy/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    // 🚨 THE FIX: Next.js 15+ requires awaiting cookies()
    const cookieStore = await cookies();
    const token = cookieStore.get('een_stream_token')?.value;

    if (!targetUrl || !token) {
      return new NextResponse("Missing URL or Token Cookie", { status: 401 });
    }

    const response = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`EEN API Error (${response.status}):`, errText);
      return new NextResponse(`EEN Error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';

    // ==========================================
    // 🧠 PLAYLIST REWRITING
    // ==========================================
    if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8') || targetUrl.includes('getPlaylist')) {
      let text = await response.text();
      const targetUrlObj = new URL(targetUrl);
      const baseUrl = targetUrlObj.origin; 

      const lines = text.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          let absoluteChunkUrl = trimmedLine;
          if (!trimmedLine.startsWith('http')) {
             absoluteChunkUrl = trimmedLine.startsWith('/') 
               ? `${baseUrl}${trimmedLine}` 
               : `${baseUrl}/${trimmedLine}`;
          }
          // Only pass the URL. The browser will auto-attach the cookie!
          return `/api/cameras/proxy?url=${encodeURIComponent(absoluteChunkUrl)}`;
        }
        return trimmedLine;
      });

      return new NextResponse(rewrittenLines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ==========================================
    // 📼 BINARY CHUNKS
    // ==========================================
    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType || 'video/MP2T',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    console.error("Proxy Crash:", error.message);
    return new NextResponse("Proxy Error", { status: 500 });
  }
}
