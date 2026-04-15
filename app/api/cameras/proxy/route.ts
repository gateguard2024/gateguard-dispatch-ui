// app/api/cameras/proxy/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    // 🚨 THE FIX: Grab the token from the header, not the URL!
    const token = request.headers.get('authorization')?.split('Bearer ')[1];

    if (!targetUrl || !token) {
      return new NextResponse("Missing URL or Token", { status: 400 });
    }

    const response = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Proxy fetch failed: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // ==========================================
    // 🧠 THE MAGIC: Playlist Rewriting
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

          // 🚨 THE FIX: The rewritten chunks no longer have massive tokens in the URL
          return `/api/cameras/proxy?url=${encodeURIComponent(absoluteChunkUrl)}`;
        }
        return trimmedLine;
      });

      return new NextResponse(rewrittenLines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*', 
          'Access-Control-Allow-Headers': 'Authorization', // Allow the frontend to send the header!
        },
      });
    }

    // ==========================================
    // 📼 THE CHUNKS: Binary Passthrough
    // ==========================================
    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType || 'video/MP2T',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization',
      },
    });

  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    return new NextResponse("Proxy Error", { status: 500 });
  }
}
