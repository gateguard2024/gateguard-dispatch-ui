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

    const response = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      return new NextResponse(`EEN Error: ${response.status}`, { status: response.status });
    }

    // ==========================================
    // 🧠 THE MAGIC: Absolute Playlist Rewriting
    // ==========================================
    let text = await response.text();
    
    // We need to know exactly what folder the playlist is in
    const targetUrlObj = new URL(targetUrl);
    const origin = targetUrlObj.origin; 
    
    // e.g., turns /media/streams/main/hls/getPlaylist into /media/streams/main/hls
    const basePath = targetUrlObj.pathname.substring(0, targetUrlObj.pathname.lastIndexOf('/')); 

    const lines = text.split('\n');
    const rewrittenLines = lines.map(line => {
      const trimmedLine = line.trim();
      
      // If the line is a chunk URL (doesn't start with #)
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        
        let absoluteChunkUrl = trimmedLine;
        
        // 🚨 CRITICAL FIX: Properly resolve relative paths
        if (!trimmedLine.startsWith('http')) {
           // If EEN used a relative path like "../../getMpeg", resolve it
           const resolvedUrl = new URL(trimmedLine, `${origin}${basePath}/`);
           absoluteChunkUrl = resolvedUrl.toString();
        }

        // 🚨 CRITICAL FIX: Do NOT route through proxy. Let hls.js hit EEN directly.
        // EEN requires the token on the chunk URL to bypass CORS.
        return `${absoluteChunkUrl}&access_token=${token}`;
      }
      return trimmedLine;
    });

    return new NextResponse(rewrittenLines.join('\n'), {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*', // Crucial for hls.js to read it
      },
    });

  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    return new NextResponse("Proxy Error", { status: 500 });
  }
}
