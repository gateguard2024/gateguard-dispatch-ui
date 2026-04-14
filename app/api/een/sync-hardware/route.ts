// app/api/een/sync-hardware/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) throw new Error("Missing siteId in request body");

    // 1. Get credentials (and auto-refresh if expired!)
    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    // 2. Discovery: Get all cameras from EEN
    const response = await fetch(`https://${cluster}/api/v3.0/cameras`, {
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

    const cameras = await response.json();
    console.log(`🎥 SUCCESS! Retrieved ${cameras.length || 0} cameras from EEN.`);

    if (cameras && cameras.length > 0) {
      // 3. Map & Store
      const cameraMappings = cameras.map((cam: any) => ({
        site_id: siteId,
        een_camera_id: cam.id || cam.esn, // The unique EEN hardware ID
        name: cam.name,
        status: cam.status || 'unknown',
        metadata: cam // Stores the raw EEN object for future use
      }));

      // 4. Save to Database
      const { error } = await supabase
        .from('cameras')
        .upsert(cameraMappings, { onConflict: 'een_camera_id' }); 

      if (error) throw new Error(`Supabase Insert Error: ${error.message}`);
      console.log("💾 Successfully saved cameras to database!");
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully synced ${cameras.length} cameras.`,
      count: cameras.length 
    });
    
  } catch (error: any) {
    console.error("❌ Sync Hardware Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
