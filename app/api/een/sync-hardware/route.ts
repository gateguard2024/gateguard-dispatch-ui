// app/api/een/sync-hardware/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) throw new Error("Missing siteId in request body");

    // 1. Grab credentials AND the locationId for filtering
    const { token, cluster, apiKey, locationId } = await getValidEENToken(siteId);

    // 2. Dynamically build the endpoint (Filter by location if we have it)
    const endpoint = locationId 
      ? `/api/v3.0/cameras?locationId__in=${locationId}` 
      : `/api/v3.0/cameras`;

    console.log(`📡 Fetching cameras from: ${endpoint}`);

    // 3. Fetch from Eagle Eye
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
    const cameraArray = rawData.results || [];

    console.log(`🎥 SUCCESS! Found ${cameraArray.length} cameras for this location.`);

    if (cameraArray.length > 0) {
      // 4. Map & Extract specific fields for the Database
      const cameraMappings = cameraArray.map((cam: any) => ({
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

      // 5. Save to Database
      const { error } = await supabase
        .from('cameras')
        .upsert(cameraMappings, { onConflict: 'een_camera_id' }); 

      if (error) throw new Error(`Supabase Insert Error: ${error.message}`);
      console.log("💾 Successfully saved exact location cameras to database!");
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully synced ${cameraArray.length} cameras.`,
      count: cameraArray.length
    });
    
  } catch (error: any) {
    console.error("❌ Sync Hardware Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
