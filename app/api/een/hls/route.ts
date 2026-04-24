// app/api/een/hls/route.ts
//
// Server-side HLS proxy for EEN recorded video.
//
// Why this exists:
//   EEN's media server (media.c031.eagleeyenetworks.com etc.) does NOT send
//   CORS headers, so browsers cannot fetch HLS manifests or segments directly.
//   All requests must be proxied through our server, which adds the Bearer token
//   and returns content with permissive CORS headers.
//
// How it works:
//   1. Browser requests /api/een/hls?accountId={id}&url={encoded_een_url}
//   2. This route fetches the resource from EEN with Bearer token auth
//   3. If the resource is an m3u8 manifest, it rewrites all segment URLs
//      to also go through this proxy (preserving auth for each segment)
//   4. For video/audio segments, content is streamed directly to the browser
//
// GET /api/een/hls?accountId={supabase_uuid}&url={encoded_full_een_url}

import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const targetUrl = searchParams.get('url');

    if (!accountId || !targetUrl) {
      return new Response('Missing required params: accountId, url', { status: 400 });
    }

    // Get auth token for this account
    const { token, apiKey } = await getValidEENToken(accountId);
    if (!token) {
      return new Response('EEN not authenticated', { status: 401 });
    }

    const eenHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    };
    if (apiKey) eenHeaders['x-api-key'] = apiKey;

    // Fetch from EEN
    const eenRes = await fetch(targetUrl, { headers: eenHeaders });

    if (!eenRes.ok) {
      console.error(`[een/hls] EEN ${eenRes.status} for ${targetUrl.slice(0, 120)}`);
      return new Response(null, { status: eenRes.status });
    }

    const contentType = eenRes.headers.get('content-type') ?? '';
    const isManifest  = contentType.includes('mpegurl') || targetUrl.includes('.m3u8');

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };

    if (isManifest) {
      // ── HLS manifest — rewrite segment URLs to go through this proxy ──
      const text = await eenRes.text();

      // Derive base URL for resolving relative paths
      const parsedUrl = new URL(targetUrl);
      const lastSlash = parsedUrl.href.lastIndexOf('/');
      const basePath  = parsedUrl.href.substring(0, lastSlash + 1);

      // Helper: resolve a possibly-relative URL to absolute, then wrap in proxy
      const toProxyUrl = (uri: string): string => {
        let absoluteUrl: string;
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          absoluteUrl = uri;
        } else if (uri.startsWith('/')) {
          absoluteUrl = `${parsedUrl.protocol}//${parsedUrl.host}${uri}`;
        } else {
          absoluteUrl = `${basePath}${uri}`;
        }
        return `/api/een/hls?accountId=${encodeURIComponent(accountId)}&url=${encodeURIComponent(absoluteUrl)}`;
      };

      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Plain segment URL — non-comment line
        if (!trimmed.startsWith('#')) {
          return toProxyUrl(trimmed);
        }

        // HLS tags containing URI="..." attributes (e.g. #EXT-X-MAP, #EXT-X-KEY)
        // These are comment lines but contain URLs that must also be proxied
        if (trimmed.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
            return `URI="${toProxyUrl(uri)}"`;
          });
        }

        return line;
      }).join('\n');

      return new Response(rewritten, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── Video/audio segment — stream directly ─────────────────────────────
    const body = await eenRes.arrayBuffer();

    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType || 'video/mp4',
        'Cache-Control': 'public, max-age=300',
      },
    });

  } catch (err: any) {
    console.error('[een/hls] Error:', err.message);
    return new Response(err.message, { status: 500 });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
