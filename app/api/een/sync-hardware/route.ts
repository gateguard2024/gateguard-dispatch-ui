// app/api/een/sync/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // 1. Unlock the Vault: Get the keys and cluster
    const { data: site, error: dbError } = await supabase
      .from('sites')
      .select('id, een_access_token, een_api_key, een_cluster')
      .eq('id', siteId)
      .single();

    if (dbError || !site) {
      throw new Error(`Database error or site not found for ID: ${siteId}`);
    }

    if (!site.een_access_token) throw new Error("Missing Access Token. Must authenticate first.");
    if (!site.een_api_key) throw new Error("Missing API Key in database.");
    if (!site.een_cluster) throw new Error("Missing Cluster URL in database.");

    // 2. Call the Eagle Eye V3 Cameras Endpoint
    const eenUrl = `https://${site.een_cluster}/api/v3.0/cameras`;
    console.log(`📡 Requesting cameras from: ${eenUrl}`);

    const eenResponse = await fetch(eenUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${site.een_access_token}`, 
        'x-api-key': site.een_api_key,                      
        'Content-Type': 'application/json'
      }
    });

    if (!eenResponse.ok) {
      const errText = await eenResponse.text();
      throw new Error(`Eagle Eye API rejected sync: ${eenResponse.status} - ${errText}`);
    }

    const cameraData = await eenResponse.json();
    console.log(`🎥 SUCCESS! Retrieved ${cameraData.length || 0} cameras from EEN.`);

    // 3. Format the data for Supabase
    // Make sure these column names match your Supabase 'cameras' table!
    if (cameraData && cameraData.length > 0) {
      const camerasToSave = cameraData.map((cam: any) => ({
        site_id: site.id,               // Links to your sites table
        een_camera_id: cam.id,          // The unique EEN hardware ID
        name: cam.name,                 // The camera name (e.g., "Front Gate")
        status: cam.status || 'unknown' // Online/Offline status
      }));

      // 4. Save to Database (Upsert prevents duplicates on subsequent syncs)
      const { error: insertError } = await supabase
        .from('cameras')
        .upsert(camerasToSave, { 
          onConflict: 'een_camera_id' // If this EEN ID already exists, update it instead of crashing
        });

      if (insertError) {
        throw new Error(`Failed to save cameras to Supabase: ${insertError.message}`);
      }
      
      console.log("💾 Successfully saved cameras to database!");
    }

    return NextResponse.json({ 
      success: true, 
      count: cameraData.length || 0, 
      message: "Hardware sync and database save complete."
    });

  } catch (err: any) {
    console.error("❌ Hardware Sync Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
