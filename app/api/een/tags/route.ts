// app/api/een/tags/route.ts
//
// Returns the unique EEN property tags available on a given account.
//
// Always calls EEN live — the fast-path DB shortcut was removed because it
// only returned tags for already-synced cameras, missing any new tags set up
// in EEN after the first zone was configured.
//
// Why not a separate EEN "tags" endpoint?
//   EEN V3 has no standalone tags endpoint. Tags are properties of cameras.
//   This route is a lightweight version of sync-hardware that returns tag
//   names only, without writing anything to the database.
//
// Request body:  { siteId: string }   ← Supabase accounts.id (UUID)
// Response:      { success: true, tags: string[], source: "een" }

import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountId: string | undefined = body.siteId ?? body.accountId;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing required field: siteId' },
        { status: 400 }
      );
    }

    // Always call EEN live — this is the setup wizard (infrequent) and
    // accuracy matters more than latency here.
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
