// app/api/een/tags/route.ts
//
// Returns the unique EEN property tags available on a given account.
//
// Strategy (two-tier):
//   1. FAST PATH — if cameras already exist in Supabase for this account,
//      derive tags directly from the stored een_tags column.
//      No EEN API call needed, responds in ~50ms.
//
//   2. LIVE PATH — if no cameras exist yet (fresh account / first setup),
//      call EEN GET /api/v3.0/cameras?include=tags and extract unique tags
//      from the camera objects. Same auth pattern as sync-hardware.
//
// Why not a separate EEN "tags" endpoint?
//   EEN V3 has no standalone tags endpoint. Tags are properties of cameras.
//   This route is a lightweight version of sync-hardware that returns tag
//   names only, without writing anything to the database.
//
// Request body:  { siteId: string }   ← Supabase accounts.id (UUID)
// Response:      { success: true, tags: string[], source: "db" | "een" }

// app/api/een/tags/route.ts
import { NextResponse } from 'next/server';
import { createClient }  from '@supabase/supabase-js';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const accountId: string | undefined = body.siteId ?? body.accountId;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing required field: siteId' },
        { status: 400 }
      );
    }

    // Fast path: derive tags from cameras already in Supabase
    const { data: existingCameras, error: camErr } = await supabase
      .from('cameras')
      .select('een_tags')
      .eq('account_id', accountId)
      .not('een_tags', 'is', null);

    if (!camErr && existingCameras && existingCameras.length > 0) {
      const tagSet = new Set<string>();
      for (const cam of existingCameras) {
        const tags: string[] = cam.een_tags ?? [];
        for (const t of tags) {
          const clean = t.trim();
          if (clean) tagSet.add(clean);
        }
      }
      const tags = Array.from(tagSet).sort();
      return NextResponse.json({ success: true, tags, source: 'db' });
    }

    // Live path: call EEN cameras endpoint
    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!cluster) {
      return NextResponse.json(
        { error: 'EEN not authenticated for this account. Complete OAuth in Setup first.' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ pageSize: '500', include: 'tags' });

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

    const eenData  = await eenRes.json();
    const cameras: any[] = eenData.results ?? eenData.data ?? [];

    const tagSet = new Set<string>();
    for (const cam of cameras) {
      const rawTags: any[] = cam.tags ?? cam.tagList ?? [];
      for (const t of rawTags) {
        const name = (typeof t === 'string' ? t : t?.name ?? '').trim();
        if (name) tagSet.add(name);
      }
    }

    const tags = Array.from(tagSet).sort();
    return NextResponse.json({ success: true, tags, source: 'een' });

  } catch (err: any) {
    console.error('[een/tags] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
