// app/api/een/sync-hardware/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) throw new Error("Missing siteId in request body");

    // 1. Fetch the Site config from Supabase to get the Location ID and Tag
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('een_tag, een_location_id')
      .eq('id', siteId)
      .single();

    if (siteError) throw new Error("Failed to fetch site configuration from database.");

    // 2. Grab credentials
    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    // 3. 🚨 THE FIX: Build the exact query based on the EEN V3 Docs
    const params = new URLSearchParams();
    
    // Maximize the page size so we don't miss cameras due to pagination (Max 500 per EEN docs)
    params.append('pageSize', '500');

    if (site?.een_location_id) {
      params.append('locationId__in', site.een_location_id);
    }

    if (site?.een_tag) {
      // Using the exact parameter from your docs!
      params.append('tags__contains', site.een_tag); 
    }

    const endpoint = `/api/v3.0/cameras?${params.toString()}`;

    console.log(`📡 Fetching targeted cameras with URL: ${endpoint}`);

    // 4. Fetch the perfectly filtered list from Eagle Eye
    const response = await fetch(`https://${cluster}${endpoint}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-api-key': apiKey, 
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Eagle Eye API Error (${response.status}): ${errText}`);
    }

    const rawData = await response.json();
    const cameras = rawData.results || [];

    console.log(`🎥 SUCCESS! EEN returned ${cameras.length} cameras matching the exact tag and location.`);

    if (cameras.length === 0) {
       return NextResponse.json({ 
         success: true,
         message: `Successfully synced 0 cameras. No cameras match this exact Sub-Account and Tag combination.`,
         count: 0
       });
    }

    // 5. Map & Extract specific fields for the Database
    const cameraMappings = cameras.map((cam: any) => ({
      site_id: siteId,
      een_camera_id: cam.id, 
      name: cam.name || 'Unnamed Camera',
      status: cam.status ? JSON.stringify(cam.status) : 'unknown', 
      
      // Extracted Enterprise Fields
      een_bridge_id: cam.bridgeId || null,
      een_account_id: cam.accountId || null,
      een_speaker_id: cam.speakerId || null,
      een_multi_camera_id: cam.multiCameraId || null,
      een_created_timestamp: cam.createTimestamp || null,
      
      // Raw backup
      metadata: cam 
    }));

    // 6. Upsert the valid cameras
    const { error: upsertError } = await supabase
      .from('cameras')
      .upsert(cameraMappings, { onConflict: 'een_camera_id' }); 

    if (upsertError) throw new Error(`Supabase Insert Error: ${upsertError.message}`);
    
    // 7. THE CLEANUP ENGINE (True Sync)
    // Delete any cameras associated with THIS specific site that no longer match the EEN tag list
    const validCameraIds = cameras.map((c: any) => c.id);
    
    if (validCameraIds.length > 0) {
        const { error: cleanupError } = await supabase
          .from('cameras')
          .delete()
          .eq('site_id', siteId)
          .not('een_camera_id', 'in', `(${validCameraIds.join(',')})`);
          
        if (cleanupError) {
          console.error("Cleanup error (Failed to delete orphans):", cleanupError.message);
        }
    }

    console.log("💾 Successfully saved and cleaned up database!");

    return NextResponse.json({ 
      success: true,
      message: `Successfully synced ${cameras.length} cameras and cleared stale data.`,
      count: cameras.length
    });
    
  } catch (error: any) {
    console.error("❌ Sync Hardware Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
