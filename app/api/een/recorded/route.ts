// app/api/een/recorded/route.ts
//
// Two endpoints in one file:
//
// POST /api/een/recorded
//   Returns a single HLS URL for a specific time window (used by SmartVideoPlayer)
//   Body: { accountId, cameraId, startTime, endTime }
//   Response: { url, type, clipCount, startTimestamp, endTimestamp }
//
// GET /api/een/recorded?accountId=&cameraId=&startTime=&endTime=
//   Returns ALL recording segments in a time range (used to draw the timeline)
//   Response: { segments: [{ hlsUrl, mp4Url, startTimestamp, endTimestamp, type }] }
//
// EEN /media endpoint:
//   - Requires ISO 8601 timestamps: YYYY-MM-DDTHH:MM:SS.sss+hh:mm
//   - The '+' in '+00:00' MUST be encoded as '%2B' in query strings
//   - Colons must stay RAW (EEN rejects %3A)
//   - Tries type=main first, falls back to type=preview if no results
//   - hlsUrl is the correct field name (confirmed from EEN API docs)

import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

// ─── Timestamp encoding ───────────────────────────────────────────────────────
// ISO 8601 with '+' encoded as '%2B' — EEN requires this exact format
function encodeTs(iso: string): string {
  return iso.replace(/Z$/, '+00:00').replace(/\+/g, '%2B');
}

// ─── Query EEN media for a given type ────────────────────────────────────────
async function fetchMediaSegments(
  cluster: string,
  token: string,
  apiKey: string | null,
  cameraId: string,
  startIso: string,
  endIso: string,
  type: 'main' | 'preview'
): Promise<any[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  const url = [
    `https://${cluster}/api/v3.0/media`,
    `?deviceId=${encodeURIComponent(cameraId)}`,
    `&type=${type}`,
    `&mediaType=video`,
    `&startTimestamp__gte=${encodeTs(startIso)}`,
    `&endTimestamp__lte=${encodeTs(endIso)}`,
    `&include=hlsUrl,mp4Url`,   // REQUIRED — EEN omits URL fields without this
    `&coalesce=true`,
    `&pageSize=100`,
  ].join('');

  console.log(`[een/recorded] Querying type=${type}: ${url}`);

  const res = await fetch(url, { method: 'GET', headers });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[een/recorded] EEN ${res.status} for type=${type}: ${errText.slice(0, 300)}`);
    return [];
  }

  const data = await res.json();
  return data.results ?? [];
}

// ─── GET — Timeline segments (all recording windows in range) ─────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const cameraId  = searchParams.get('cameraId');
    const startTime = searchParams.get('startTime');
    const endTime   = searchParams.get('endTime');

    if (!accountId || !cameraId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required params: accountId, cameraId, startTime, endTime' },
        { status: 400 }
      );
    }

    const { token, cluster, apiKey } = await getValidEENToken(accountId);
    if (!cluster || !token) {
      return NextResponse.json({ error: 'EEN not authenticated.' }, { status: 400 });
    }

    const startIso = new Date(startTime).toISOString();
    const endIso   = new Date(endTime).toISOString();

    // Try main first, fall back to preview
    let segments = await fetchMediaSegments(cluster, token, apiKey, cameraId, startIso, endIso, 'main');
    let usedType  = 'main';

    if (segments.length === 0) {
      console.log('[een/recorded] No main recordings — trying preview');
      segments = await fetchMediaSegments(cluster, token, apiKey, cameraId, startIso, endIso, 'preview');
      usedType  = 'preview';
    }

    console.log(`[een/recorded] Timeline: ${segments.length} segments (type=${usedType})`);

    return NextResponse.json({
      segments: segments.map(s => ({
        hlsUrl:         s.hlsUrl         ?? null,
        mp4Url:         s.mp4Url         ?? null,
        startTimestamp: s.startTimestamp ?? null,
        endTimestamp:   s.endTimestamp   ?? null,
        type:           s.type           ?? usedType,
      })),
      type: usedType,
      count: segments.length,
    });

  } catch (err: any) {
    console.error('[een/recorded] GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST — Single clip URL (for SmartVideoPlayer) ───────────────────────────
export async function POST(request: Request) {
  try {
    const body      = await request.json();
    const accountId = body.accountId ?? body.siteId;
    const cameraId  = body.cameraId;
    const startTime = body.startTime;
    const endTime   = body.endTime;

    if (!accountId || !cameraId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, cameraId, startTime, endTime' },
        { status: 400 }
      );
    }

    const { token, cluster, apiKey } = await getValidEENToken(accountId);
    if (!cluster || !token) {
      return NextResponse.json({ error: 'EEN not authenticated.' }, { status: 400 });
    }

    const startIso = new Date(startTime).toISOString();
    const endIso   = new Date(endTime).toISOString();

    // Try main first, fall back to preview
    let clips    = await fetchMediaSegments(cluster, token, apiKey, cameraId, startIso, endIso, 'main');
    let usedType = 'main';

    if (clips.length === 0) {
      console.log('[een/recorded] No main clips — trying preview');
      clips    = await fetchMediaSegments(cluster, token, apiKey, cameraId, startIso, endIso, 'preview');
      usedType = 'preview';
    }

    if (clips.length === 0) {
      return NextResponse.json(
        { error: 'No recording found for the selected time range. The camera may not have been recording during this window.' },
        { status: 404 }
      );
    }

    // Log full first clip for debugging
    console.log(`[een/recorded] First clip keys: ${Object.keys(clips[0]).join(', ')}`);
    console.log(`[een/recorded] First clip: ${JSON.stringify(clips[0]).slice(0, 600)}`);

    // Build full clip list — EEN records in ~30-min segments so a 4h window
    // returns ~8 clips. We return ALL of them so the UI can let the agent
    // navigate between segments (binary-search investigation workflow).
    const allClips = clips
      .map((c: any) => ({
        url:            c.hlsUrl ?? c.hlsPlaybackUrl ?? c.streamUrl ?? c.mp4Url ?? null,
        startTimestamp: c.startTimestamp ?? null,
        endTimestamp:   c.endTimestamp   ?? null,
      }))
      .filter((c: any) => c.url !== null);

    if (allClips.length === 0) {
      return NextResponse.json(
        {
          error:    'EEN returned clips but no HLS URL found in any segment.',
          clipKeys: Object.keys(clips[0]),
          clip:     clips[0],
        },
        { status: 404 }
      );
    }

    console.log(`[een/recorded] ✓ type=${usedType} | ${allClips.length} segment(s) | first URL: ${String(allClips[0].url).slice(0, 80)}...`);

    return NextResponse.json({
      // ── Backward-compat single-clip fields ──
      url:            allClips[0].url,
      token,                        // required by HLS.js fetchSetup for auth headers
      type:           usedType,
      clipCount:      allClips.length,
      startTimestamp: allClips[0].startTimestamp,
      endTimestamp:   allClips[allClips.length - 1].endTimestamp,
      // ── Full segment list for navigator UI ──
      clips: allClips,
    });

  } catch (err: any) {
    console.error('[een/recorded] POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
