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
    const { zoneId, ignoreTag = false } = body;

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
    // ignoreTag=true → pull ALL cameras on the account regardless of tag (used when tag assignment is incomplete)
    const isSingleSite = ignoreTag || !eenTag || eenTag.trim() === '';

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

    // Log first camera's raw shape so we can debug tag field names in Vercel logs
    if (cameras.length > 0) {
      const sample = cameras[0];
      console.log(`[sync-hardware] Sample camera keys: ${Object.keys(sample).join(', ')}`);
      console.log(`[sync-hardware] Sample tags field: ${JSON.stringify(sample.tags ?? sample.tagList ?? sample.deviceTags ?? sample.labels ?? 'NONE')}`);
    }

    // JS-side tag filter — handles multiple EEN tag field names
    // EEN V3 API uses 'tags' as array of strings on most responses,
    // but some EEN deployments use tagList (array of strings) or
    // deviceTags / labels (array of objects with name/value).
    if (!isSingleSite && cameras.length > 0) {
      const tagLower = eenTag.toLowerCase().trim();

      const extractTags = (cam: any): string[] => {
        // Try every known EEN tag field name, extract to array of lowercase strings
        const raw = cam.tags ?? cam.tagList ?? cam.deviceTags ?? cam.labels ?? [];
        return (Array.isArray(raw) ? raw : []).map((t: any) => {
          if (typeof t === 'string') return t.toLowerCase().trim();
          // Object form: {name, value, label, id} — try each
          return (t?.name ?? t?.value ?? t?.label ?? t?.tagName ?? '').toLowerCase().trim();
        }).filter(Boolean);
      };

      const jsFiltered = cameras.filter((cam: any) => {
        const camTags = extractTags(cam);
        // Exact match OR the camera name starts with the zone tag (fallback for untagged setups)
        return camTags.includes(tagLower);
      });

      if (jsFiltered.length > 0) {
        cameras = jsFiltered;
        console.log(`[sync-hardware] Tag filter matched ${cameras.length} cameras for tag "${eenTag}"`);
      } else {
        // No cameras matched the tag — log what tags we DID see, then fall back to full result
        const allTags = [...new Set(cameras.flatMap((c: any) => extractTags(c)))];
        console.warn(`[sync-hardware] Tag "${eenTag}" matched 0 cameras. Tags seen: ${allTags.join(', ') || 'NONE'} — using full account result`);
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
    // Reuse the same extractTags helper defined above (hoisted here for upsert row building)
    const extractTagStrings = (cam: any): string[] => {
      const raw = cam.tags ?? cam.tagList ?? cam.deviceTags ?? cam.labels ?? [];
      return (Array.isArray(raw) ? raw : []).map((t: any) => {
        if (typeof t === 'string') return t.trim();
        return (t?.name ?? t?.value ?? t?.label ?? t?.tagName ?? '').trim();
      }).filter(Boolean);
    };

    const now = new Date().toISOString();

    const rows = cameras
      .map((cam: any) => {
        // EEN returns status as { connectionStatus: 'online' | 'offline' } or a string directly
        const connStatus = cam.status?.connectionStatus ?? cam.status?.status ?? cam.connectionStatus ?? null;
        const isOnline = connStatus != null
          ? (typeof connStatus === 'string' ? connStatus.toLowerCase() === 'online' : null)
          : null;

        return {
          zone_id:        zoneId,
          account_id:     accountId,
          een_camera_id:  cam.id ?? cam.deviceId ?? cam.esn ?? null,
          name:           cam.name ?? cam.deviceName ?? 'Unnamed Camera',
          source:         'een',
          is_monitored:   true,
          snapshot_url:   null,
          een_tags:       extractTagStrings(cam),
          is_online:      isOnline,
          last_seen_at:   isOnline !== null ? now : undefined,
        };
      })
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
