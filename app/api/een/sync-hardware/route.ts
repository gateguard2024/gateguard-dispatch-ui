// app/api/een/sync-hardware/route.ts
//
// Syncs Eagle Eye Networks cameras into the GateGuard cameras table for a given zone.
//
// How it works:
//   - Reads the zone's een_tag field to determine which cameras belong to this zone
//   - een_tag = ''  → single-site account: syncs ALL cameras on the EEN account
//   - een_tag = 'X' → multi-site account: syncs only cameras tagged 'X' in EEN
//
// Uses a dual-engine filter:
//   Primary:  EEN API-level tag filter (?tags[]={tagName})
//   Fallback: JavaScript-side filter on camera.tags array (catches EEN deployments
//             that ignore the API filter param)
//
// Called by: Setup wizard Step 4, and the Refresh button on zone detail view.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  // Initialise inside the handler so env vars are read at request-time,
  // not at build-time (avoids "supabaseKey is required" build error).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const { zoneId } = body;

    if (!zoneId) {
      return NextResponse.json({ error: 'Missing required field: zoneId' }, { status: 400 });
    }

    // ── 1. Load zone ──────────────────────────────────────────────────────────
    const { data: zone, error: zoneErr } = await supabase
      .from('zones')
      .select('id, account_id, name, een_tag')
      .eq('id', zoneId)
      .single();

    if (zoneErr || !zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const { account_id: accountId, name: zoneName, een_tag: eenTag } = zone;
    const isSingleSite = !eenTag || eenTag.trim() === '';

    console.log(`[sync-hardware] Zone: "${zoneName}" | Account: ${accountId} | Tag: "${eenTag || 'ALL'}"`);

    // ── 2. Get valid EEN token ────────────────────────────────────────────────
    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!cluster) {
      return NextResponse.json(
        { error: 'EEN not authenticated. Re-authorize this account in Setup.' },
        { status: 400 }
      );
    }

    // ── 3. Fetch cameras from EEN V3 ──────────────────────────────────────────
    // Note: EEN V3 does not support a server-side tag filter on GET /cameras.
    // We fetch all cameras and apply the tag filter in JS below.
    const params = new URLSearchParams({
      pageSize: '500',
      include:  'tags,status',
    });

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

    const eenData = await eenRes.json();
    let cameras: any[] = eenData.results ?? eenData.data ?? [];

    console.log(`[sync-hardware] EEN returned ${cameras.length} cameras`);

    // Fallback engine: JS-side tag filter
    // If the API ignored the tag param and returned everything, filter here.
    if (!isSingleSite && cameras.length > 0) {
      const tagLower   = eenTag.toLowerCase();
      const jsFiltered = cameras.filter((cam: any) => {
        const tags: string[] = (cam.tags ?? cam.tagList ?? []).map((t: any) =>
          (typeof t === 'string' ? t : t?.name ?? '').toLowerCase()
        );
        return tags.includes(tagLower);
      });

      if (jsFiltered.length > 0) {
        cameras = jsFiltered;
        console.log(`[sync-hardware] JS tag filter: ${cameras.length} cameras match tag "${eenTag}"`);
      } else {
        // JS filter returned nothing — either API already filtered correctly,
        // or cameras genuinely have no tag. Trust the API result.
        console.warn(`[sync-hardware] JS tag filter matched 0 cameras — using full API result`);
      }
    }

    if (cameras.length === 0) {
      const message = isSingleSite
        ? 'No cameras found on this EEN account. Check that cameras are registered and online in Eagle Eye Networks.'
        : `No cameras found with tag "${eenTag}". Verify the tag name matches exactly in Eagle Eye Networks, then re-scan.`;

      return NextResponse.json({ success: true, synced: 0, pruned: 0, message });
    }

    // ── 4. Build upsert rows ──────────────────────────────────────────────────
    //
    // EEN camera object fields used:
    //   id / deviceId  → een_camera_id (the device ESN — unique hardware identifier)
    //   name           → display name
    //   tags / tagList → array of tag strings
    //   status         → { connectionStatus: 'online' | 'offline' }
    //
    const rows = cameras
      .map((cam: any) => ({
        zone_id:       zoneId,
        account_id:    accountId,
        een_camera_id: cam.id ?? cam.deviceId ?? cam.esn ?? null,
        name:          cam.name ?? cam.deviceName ?? 'Unnamed Camera',
        source:        'een',
        is_monitored:  true,
        snapshot_url:  null,
        een_tags:      (cam.tags ?? cam.tagList ?? []).map((t: any) =>
                         typeof t === 'string' ? t : (t?.name ?? '')
                       ),
      }))
      .filter(r => r.een_camera_id != null);

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error:   'EEN returned cameras but none had a valid device ID (ESN). Check EEN account configuration.',
      });
    }

    // ── 5. Upsert into cameras table ──────────────────────────────────────────
    const { error: upsertErr } = await supabase
      .from('cameras')
      .upsert(rows, {
        onConflict:       'een_camera_id',
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      throw new Error(`Supabase upsert failed: ${upsertErr.message}`);
    }

    // ── 6. Prune stale cameras ────────────────────────────────────────────────
    // Remove cameras that were previously in this zone but are no longer returned
    // by EEN (e.g. camera was removed from the tag, or decommissioned).
    const syncedEsnSet = new Set(rows.map(r => r.een_camera_id));

    const { data: existing } = await supabase
      .from('cameras')
      .select('id, een_camera_id')
      .eq('zone_id', zoneId)
      .eq('source', 'een');

    const toDelete = (existing ?? [])
      .filter(c => !syncedEsnSet.has(c.een_camera_id))
      .map(c => c.id);

    if (toDelete.length > 0) {
      await supabase.from('cameras').delete().in('id', toDelete);
      console.log(`[sync-hardware] Pruned ${toDelete.length} stale cameras from zone "${zoneName}"`);
    }

    console.log(`[sync-hardware] ✓ Synced ${rows.length} cameras | Pruned ${toDelete.length}`);

    return NextResponse.json({
      success: true,
      synced:  rows.length,
      pruned:  toDelete.length,
      zone:    { id: zoneId, name: zoneName, een_tag: eenTag || null },
    });

  } catch (err: any) {
    console.error('[sync-hardware] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
