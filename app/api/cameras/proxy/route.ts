// app/api/cameras/proxy/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const token = url.searchParams.get('token'); 

    if (!targetUrl || !token) {
      return new NextResponse("Missing URL or Token", { status: 400 });
    }

    // 1. The Server fetches the resource (Bypasses EEN's CORS block!)
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
      
      // Get the base EEN server URL (e.g., https://media.c031.eagleeyenetworks.com)
      const targetUrlObj = new URL(targetUrl);
      const baseUrl = targetUrlObj.origin; 

      // Regex/Mapping to find the chunk paths and rewrite them
      const lines = text.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmedLine = line.trim();
        // If the line is a chunk URL (doesn't start with #)
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          
          let absoluteChunkUrl = trimmedLine;
          if (!trimmedLine.startsWith('http')) {
             absoluteChunkUrl = trimmedLine.startsWith('/') 
               ? `${baseUrl}${trimmedLine}` 
               : `${baseUrl}/${trimmedLine}`;
          }

          // Force the frontend to route THIS 10-second chunk through our proxy too!
          return `/api/cameras/proxy?url=${encodeURIComponent(absoluteChunkUrl)}&token=${token}`;
        }
        return trimmedLine;
      });

      return new NextResponse(rewrittenLines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*', // Tells the browser "Yes, you can play this"
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
      },
    });

  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    return new NextResponse("Proxy Error", { status: 500 });
  }
}
