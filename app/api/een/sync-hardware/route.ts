// app/api/een/sync-hardware/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) throw new Error("Missing siteId in request body");

    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('een_tag, een_location_id')
      .eq('id', siteId)
      .single();

    if (siteError) throw new Error("Failed to fetch site config from DB.");

    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    // ==========================================
    // ENGINE 1: NATIVE API FILTERING
    // ==========================================
    const params = new URLSearchParams();
    params.append('pageSize', '500'); // Get max allowed cameras per request
    
    if (site?.een_tag) {
      params.append('tags__contains', site.een_tag);
    }

    let endpoint = `/api/v3.0/cameras?${params.toString()}`;
    console.log(`📡 ENGINE 1: Fetching natively by tag -> ${endpoint}`);

    let response = await fetch(`https://${cluster}${endpoint}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey, 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`EEN API Error: ${response.status}`);
    let rawData = await response.json();
    let cameras = rawData.results || [];

    // ==========================================
    // ENGINE 2: JAVASCRIPT FALLBACK (The Safety Net)
    // ==========================================
    if (cameras.length === 0 && site?.een_tag) {
      console.log(`⚠️ ENGINE 1 returned 0 cameras. Falling back to ENGINE 2 (JavaScript Map/Filter)...`);
      
      // Pull EVERYTHING without filters
      response = await fetch(`https://${cluster}/api/v3.0/cameras?pageSize=500`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey, 'Content-Type': 'application/json' }
      });
      
      rawData = await response.json();
      const allCameras = rawData.results || [];

      console.log(`📊 EEN returned ${allCameras.length} total cameras. JS Engine scanning for tag: '${site.een_tag}'...`);

      // Filter natively in JS (Case insensitive, ignores weird spacing)
      const targetTag = site.een_tag.trim().toLowerCase();
      cameras = allCameras.filter((cam: any) => {
        if (!cam.tags || !Array.isArray(cam.tags)) return false;
        return cam.tags.some((t: string) => t.trim().toLowerCase() === targetTag);
      });

      // DIAGNOSTIC CHEAT SHEET
      if (cameras.length === 0 && allCameras.length > 0) {
        const availableTags = new Set<string>();
        allCameras.forEach((c: any) => {
          if (c.tags && Array.isArray(c.tags)) c.tags.forEach((t: string) => availableTags.add(t));
        });
        const tagList = Array.from(availableTags).join(', ');
        throw new Error(`Found 0 cameras matching "${site.een_tag}". \n\nTags actually available on your cameras: [${tagList}]`);
      }
    }

    if (cameras.length === 0) {
       return NextResponse.json({ success: true, message: `0 cameras found anywhere.`, count: 0 });
    }

    console.log(`🎥 SUCCESS! Harvested ${cameras.length} cameras.`);

    // ==========================================
    // DATABASE UPSERT & CLEANUP
    // ==========================================
    const cameraMappings = cameras.map((cam: any) => ({
      site_id: siteId,
      een_camera_id: cam.id, 
      name: cam.name || 'Unnamed Camera',
      status: cam.status ? JSON.stringify(cam.status) : 'unknown', 
      een_bridge_id: cam.bridgeId || null,
      een_account_id: cam.accountId || null,
      een_speaker_id: cam.speakerId || null,
      metadata: cam 
    }));

    const { error: upsertError } = await supabase
      .from('cameras')
      .upsert(cameraMappings, { onConflict: 'een_camera_id' }); 

    if (upsertError) throw new Error(`Supabase Insert Error: ${upsertError.message}`);
    
    // Prune cameras that lost their tag
    const validCameraIds = cameras.map((c: any) => c.id);
    await supabase.from('cameras').delete().eq('site_id', siteId).not('een_camera_id', 'in', `(${validCameraIds.join(',')})`);

    console.log("💾 Saved to DB.");

    return NextResponse.json({ success: true, message: `Successfully synced ${cameras.length} cameras.`, count: cameras.length });
    
  } catch (error: any) {
    console.error("❌ Sync Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
