// app/api/een/sync-hardware/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) throw new Error("Missing siteId in request body");

    // 1. Fetch the Site config from Supabase to get the specific Location ID and Tag lock
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('een_tag, een_location_id')
      .eq('id', siteId)
      .single();

    if (siteError) throw new Error("Failed to fetch site configuration from database.");

    // 2. Grab credentials from your token helper
    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    // 3. Dynamically build the endpoint
    // If they provided a Sub-Account ID, use it. Otherwise, pull from the root account.
    let endpoint = `/api/v3.0/cameras`;
    if (site?.een_location_id) {
      endpoint = `/api/v3.0/cameras?locationId__in=${site.een_location_id}`;
    }

    console.log(`📡 Fetching raw camera list from: ${endpoint}`);

    // 4. Fetch the raw array from Eagle Eye
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
    const allCameras = rawData.results || [];

    console.log(`📊 EEN returned ${allCameras.length} total cameras before filtering.`);

    // 5. 🚨 THE DIAGNOSTIC & FILTER ENGINE
    // We filter natively on our backend to bypass EEN's flaky URL query strings
    let filteredCameras = allCameras;
    
    if (site?.een_tag) {
      const targetTag = site.een_tag.trim().toLowerCase();
      
      filteredCameras = allCameras.filter((cam: any) => {
        if (!cam.tags || !Array.isArray(cam.tags)) return false;
        // Check if any tag on the camera matches the target tag
        return cam.tags.some((t: string) => t.trim().toLowerCase() === targetTag);
      });

      // INTELLIGENT FALLBACK: If 0 cameras matched the tag, generate a cheat sheet!
      if (filteredCameras.length === 0 && allCameras.length > 0) {
        const availableTags = new Set<string>();
        const availableLocations = new Set<string>();

        allCameras.forEach((c: any) => {
          if (c.locationId) availableLocations.add(c.locationId);
          if (c.tags && Array.isArray(c.tags)) {
            c.tags.forEach((t: string) => availableTags.add(t));
          }
        });

        const tagList = Array.from(availableTags).join(', ') || "No tags found on any cameras";
        const locList = Array.from(availableLocations).join(', ');

        throw new Error(
          `Found 0 cameras matching the tag "${site.een_tag}".\n\n` +
          `🔍 DIAGNOSTIC INFO:\n` +
          `Available Tags: [${tagList}]\n` +
          `Available Sub-Accounts: [${locList}]`
        );
      }
    }

    if (filteredCameras.length === 0) {
       return NextResponse.json({ 
         success: true,
         message: `Successfully synced 0 cameras. No cameras exist at this location.`,
         count: 0
       });
    }

    // 6. Map & Extract specific fields for the Database
    const cameraMappings = filteredCameras.map((cam: any) => ({
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

    // 7. Upsert the valid cameras
    const { error: upsertError } = await supabase
      .from('cameras')
      .upsert(cameraMappings, { onConflict: 'een_camera_id' }); 

    if (upsertError) throw new Error(`Supabase Insert Error: ${upsertError.message}`);
    
    // 🚨 8. THE CLEANUP ENGINE (True Sync)
    // Delete any cameras associated with THIS specific site that are no longer in the EEN tag list
    const validCameraIds = filteredCameras.map((c: any) => c.id);
    
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
      message: `Successfully synced ${filteredCameras.length} cameras and cleared stale data.`,
      count: filteredCameras.length
    });
    
  } catch (error: any) {
    console.error("❌ Sync Hardware Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
