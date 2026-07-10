// app/api/een/tags/route.ts
//
// Returns all cameras + their tags from EEN for a given account.
// Always calls EEN live — never reads from Supabase cache — so new cameras
// and new tags are visible immediately without a full sync.
//
// Also cross-references with Supabase to show which cameras are already
// synced to which zone, so mismatches are immediately obvious in the UI.
//
// Request body:  { accountId: string }   ← Supabase accounts.id (UUID)
// Response:      {
//   success: true,
//   cameras: CameraTagRow[],  ← one row per EEN camera
//   allTags: string[],        ← deduplicated sorted tag list
// }

import { NextResponse }     from 'next/server';
import { createClient }     from '@supabase/supabase-js';
import { getValidEENToken } from '@/lib/een';

interface CameraTagRow {
  esn:       string;
  name:      string;
  tags:      string[];
  is_online: boolean | null;
  synced_to: string | null;  // zone name if already in Supabase, null if not yet synced
}

// Extracts tag strings from any EEN camera object regardless of field name variant
function extractTags(cam: any): string[] {
  const raw = cam.tags ?? cam.tagList ?? cam.deviceTags ?? cam.labels ?? [];
  return (Array.isArray(raw) ? raw : [])
    .map((t: any) => {
      if (typeof t === 'string') return t.trim();
      return (t?.name ?? t?.value ?? t?.label ?? t?.tagName ?? '').trim();
    })
    .filter(Boolean);
}

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const accountId: string | undefined = body.accountId ?? body.siteId;

    if (!accountId) {
      return NextResponse.json({ error: 'Missing required field: accountId' }, { status: 400 });
    }

    // ── 1. Get valid EEN token ────────────────────────────────────────────────
    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!cluster || !token) {
      return NextResponse.json(
        { error: 'EEN not authenticated for this account. Re-run OAuth in Setup.' },
        { status: 400 }
      );
    }

    // ── 2. Fetch all cameras from EEN live (never use cached Supabase data) ──
    const params = new URLSearchParams({ pageSize: '500', include: 'tags,status' });

    const eenHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    };
    if (apiKey) eenHeaders['x-api-key'] = apiKey;

    const eenRes = await fetch(
      `https://${cluster}/api/v3.0/cameras?${params.toString()}`,
      { headers: eenHeaders }
    );

    if (!eenRes.ok) {
      const errBody = await eenRes.text();
      throw new Error(`EEN API error ${eenRes.status}: ${errBody}`);
    }

    const eenData    = await eenRes.json();
    const eenCameras: any[] = eenData.results ?? eenData.data ?? [];

    // Log raw field names to help diagnose tag field issues in Vercel logs
    if (eenCameras.length > 0) {
      const s = eenCameras[0];
      console.log(`[een/tags] keys: ${Object.keys(s).join(', ')}`);
      console.log(`[een/tags] tag fields — tags:${JSON.stringify(s.tags)} tagList:${JSON.stringify(s.tagList)} deviceTags:${JSON.stringify(s.deviceTags)} labels:${JSON.stringify(s.labels)}`);
    }

    // ── 3. Cross-reference with Supabase to find already-synced cameras ──────
    const { data: syncedCameras } = await supabase
      .from('cameras')
      .select('een_camera_id, zones(name)')
      .eq('account_id', accountId)
      .not('een_camera_id', 'is', null);

    const syncedMap = new Map<string, string>();
    for (const cam of syncedCameras ?? []) {
      const zoneName = (cam as any).zones?.name ?? 'Unknown zone';
      syncedMap.set(cam.een_camera_id, zoneName);
    }

    // ── 4. Build response ─────────────────────────────────────────────────────
    const allTagSet = new Set<string>();

    const cameras: CameraTagRow[] = eenCameras.map((cam: any) => {
      const esn  = cam.id ?? cam.deviceId ?? cam.esn ?? '';
      const tags = extractTags(cam);
      tags.forEach(t => allTagSet.add(t));

      const connStatus = cam.status?.connectionStatus ?? cam.status?.status ?? cam.connectionStatus ?? null;
      const isOnline   = connStatus != null
        ? (typeof connStatus === 'string' ? connStatus.toLowerCase() === 'online' : null)
        : null;

      return {
        esn,
        name:      cam.name ?? cam.deviceName ?? 'Unnamed Camera',
        tags,
        is_online: isOnline,
        synced_to: esn ? (syncedMap.get(esn) ?? null) : null,
      };
    });

    const allTags = Array.from(allTagSet).sort();

    console.log(`[een/tags] ${cameras.length} cameras, ${allTags.length} unique tags: ${allTags.join(', ')}`);

    return NextResponse.json({ success: true, cameras, allTags });

  } catch (err: any) {
    console.error('[een/tags] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
