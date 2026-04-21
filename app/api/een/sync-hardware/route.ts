import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidEENToken } from '@/lib/een';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { zoneId } = await request.json();

    if (!zoneId) {
      return NextResponse.json({ error: 'Missing zoneId' }, { status: 400 });
    }

    // ── 1. Fetch zone record ─────────────────────────────────────────────────
    const { data: zone, error: zoneErr } = await supabase
      .from('zones')
      .select('id, account_id, name, een_tag')
      .eq('id', zoneId)
      .single();

    if (zoneErr || !zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const accountId = zone.account_id;
    const eenTag    = zone.een_tag ?? '';          // '' = no filter (single-site)
    const isSingleSite = eenTag.trim() === '';

    console.log(
      `📷 Syncing cameras for zone "${zone.name}" (account: ${accountId}, tag: "${eenTag || 'ALL'}")`
    );

    // ── 2. Get valid EEN token ───────────────────────────────────────────────
    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!cluster) {
      return NextResponse.json(
        { error: 'EEN not authenticated for this account. Re-authorize via Setup.' },
        { status: 400 }
      );
    }

    // ── 3. Fetch cameras from EEN ────────────────────────────────────────────
    //
    // EEN V3 camera list: GET /api/v3.0/cameras
    // Params:
    //   pageSize        — return up to N cameras (max 500)
    //   include         — additional fields: 'tags,status,deviceAddress'
    //   tags[]          — filter by tag name (MULTI-SITE: use this)
    //
    const params = new URLSearchParams({
      pageSize: '500',
      include:  'tags,status',
    });

    // PRIMARY ENGINE: tag-based filter at the API level
    if (!isSingleSite) {
      params.append('tags[]', eenTag);
    }

    const camRes = await fetch(
      `https://${cluster}/api/v3.0/cameras?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-api-key':   apiKey,
          Accept:        'application/json',
        },
      }
    );

    if (!camRes.ok) {
      const errText = await camRes.text();
      throw new Error(`EEN camera list failed (${camRes.status}): ${errText}`);
    }

    const camData = await camRes.json();

    // EEN V3 returns { results: [...] } paginated
    let allCameras: any[] = camData.results ?? camData.data ?? camData ?? [];

    // FALLBACK ENGINE: if API tag filter returned ALL cameras (some EEN deployments
    // ignore the tags[] param), filter client-side as a safety net.
    if (!isSingleSite && allCameras.length > 0) {
      const tagLower = eenTag.toLowerCase();
      const filtered = allCameras.filter((cam: any) => {
        const camTags: string[] = (cam.tags ?? cam.tagList ?? []).map((t: any) =>
          typeof t === 'string' ? t.toLowerCase() : (t.name ?? '').toLowerCase()
        );
        return camTags.includes(tagLower);
      });

      // Only use JS filter if it produced results — otherwise trust API result
      if (filtered.length > 0) {
        allCameras = filtered;
        console.log(
          `🔍 JS tag filter applied: ${allCameras.length} / ${camData.results?.length ?? 0} cameras match tag "${eenTag}"`
        );
      } else {
        console.warn(
          `⚠️ JS tag filter found 0 cameras matching "${eenTag}" — using full camera list (${allCameras.length})`
        );
      }
    }

    console.log(`📷 Found ${allCameras.length} cameras for zone "${zone.name}"`);

    if (allCameras.length === 0) {
      return NextResponse.json({
        success:  true,
        synced:   0,
        message:  isSingleSite
          ? 'No cameras found on this EEN account. Check that cameras are registered in Eagle Eye.'
          : `No cameras found with tag "${eenTag}". Check the tag name in EEN and re-scan.`,
      });
    }

    // ── 4. Upsert cameras into Supabase ──────────────────────────────────────
    //
    // EEN camera fields:
    //   id (or deviceId)  → een_camera_id (the ESN / device serial number)
    //   name              → camera display name
    //   status            → { connectionStatus: 'online' | 'offline' }
    //   tags              → array of tag strings
    //
    const upsertRows = allCameras.map((cam: any) => ({
      zone_id:         zoneId,
      account_id:      accountId,
      een_camera_id:   cam.id     ?? cam.deviceId    ?? cam.esn,  // ESN
      name:            cam.name   ?? cam.deviceName  ?? 'Camera',
      source:          'een',
      is_monitored:    true,
      snapshot_url:    null,
      // Store raw EEN tag list for reference
      een_tags:        cam.tags   ?? cam.tagList     ?? [],
    }));

    // Filter out any rows missing een_camera_id
    const validRows = upsertRows.filter(r => r.een_camera_id);

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        error:   'EEN returned cameras but none had a valid device ID (ESN). Check EEN account configuration.',
      });
    }

    const { error: upsertErr } = await supabase
      .from('cameras')
      .upsert(validRows, {
        onConflict:       'een_camera_id',
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      throw new Error(`Camera upsert failed: ${upsertErr.message}`);
    }

    // ── 5. Prune cameras that no longer belong to this zone ──────────────────
    //
    // If a camera was removed from a tag in EEN, remove it from this zone.
    // We only prune cameras for THIS zone that are NOT in the current sync.
    //
    const syncedIds = validRows.map(r => r.een_camera_id);

    const { data: existingCams } = await supabase
      .from('cameras')
      .select('id, een_camera_id')
      .eq('zone_id', zoneId)
      .eq('source', 'een');

    const toDelete = (existingCams ?? [])
      .filter(c => !syncedIds.includes(c.een_camera_id))
      .map(c => c.id);

    if (toDelete.length > 0) {
      await supabase
        .from('cameras')
        .delete()
        .in('id', toDelete);

      console.log(`🗑️ Pruned ${toDelete.length} stale cameras from zone "${zone.name}"`);
    }

    console.log(`✅ Synced ${validRows.length} cameras for zone "${zone.name}"`);

    return NextResponse.json({
      success: true,
      synced:  validRows.length,
      pruned:  toDelete.length,
      zone:    { id: zoneId, name: zone.name, een_tag: eenTag },
    });

  } catch (error: any) {
    console.error('❌ sync-hardware error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
