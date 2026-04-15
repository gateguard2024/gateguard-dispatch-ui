// app/api/een/sync-hardware/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { zoneId } = await request.json();

    if (!zoneId) throw new Error("Missing zoneId in request body");

    // 1. Fetch the Zone config from Supabase
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('*')
      .eq('id', zoneId)
      .single();

    if (zoneError) throw new Error("Failed to fetch zone configuration from database.");

    // 2. Extract the Location ID directly from our clever new primary key (2026-{locationId}-{tag})
    const locationId = zone.id.split('-')[1];

    // 3. Grab credentials using the PARENT Account ID
    const { token, cluster, apiKey } = await getValidEENToken(zone.account_id);

    // ==========================================
    // ENGINE 1: NATIVE API FILTERING
    // ==========================================
    const params = new URLSearchParams();
    params.append('pageSize', '500'); 
    
    if (locationId && locationId !== 'root') {
        params.append('locationId__in', locationId);
    }

    if (zone?.een_tag) {
      params.append('tags__contains', zone.een_tag);
    }

    let endpoint = `/api/v3.0/cameras?${params.toString()}`;
    console.log(`📡 Fetching targeted cameras -> ${endpoint}`);

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
    if (cameras.length === 0 && zone?.een_tag) {
      console.log(`⚠️ NATIVE FILTER returned 0. Falling back to JS Engine...`);
      
      response = await fetch(`https://${cluster}/api/v3.0/cameras?pageSize=500`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey, 'Content-Type': 'application/json' }
      });
      
      rawData = await response.json();
      const allCameras = rawData.results || [];

      const targetTag = zone.een_tag.trim().toLowerCase();
      cameras = allCameras.filter((cam: any) => {
        if (!cam.tags || !Array.isArray(cam.tags)) return false;
        return cam.tags.some((t: string) => t.trim().toLowerCase() === targetTag);
      });
    }

    if (cameras.length === 0) {
       return NextResponse.json({ success: true, message: `0 cameras found for this zone.`, count: 0 });
    }

    // ==========================================
    // DATABASE UPSERT & CLEANUP
    // ==========================================
    const cameraMappings = cameras.map((cam: any) => ({
      zone_id: zoneId, // NOW POINTS TO THE ZONE
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
    
    // Prune stale cameras specific to this zone
    const validCameraIds = cameras.map((c: any) => c.id);
    await supabase.from('cameras').delete().eq('zone_id', zoneId).not('een_camera_id', 'in', `(${validCameraIds.join(',')})`);

    return NextResponse.json({ success: true, message: `Successfully synced ${cameras.length} cameras.`, count: cameras.length });
    
  } catch (error: any) {
    console.error("❌ Sync Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
