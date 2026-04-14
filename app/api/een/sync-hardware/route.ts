// app/api/een/sync-hardware/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) throw new Error("Missing siteId in request body");

    const { token, cluster, apiKey } = await getValidEENToken(siteId);

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

    const rawData = await response.json();

    // 🚨 THE FIX: Target the 'results' array exactly as the EEN docs specify
    const cameraArray = rawData.results || [];

    console.log(`🎥 SUCCESS! Found ${cameraArray.length} cameras inside the 'results' array.`);

    if (cameraArray.length > 0) {
      // Map & Store
      const cameraMappings = cameraArray.map((cam: any) => ({
        site_id: siteId,
        een_camera_id: cam.id, // The docs state 'id' is the required string
        name: cam.name || 'Unnamed Camera',
        // The docs state status is an object. We stringify it so it saves safely in Supabase.
        status: cam.status ? JSON.stringify(cam.status) : 'unknown', 
        metadata: cam 
      }));

      // Save to Database
      const { error } = await supabase
        .from('cameras')
        .upsert(cameraMappings, { onConflict: 'een_camera_id' }); 

      if (error) throw new Error(`Supabase Insert Error: ${error.message}`);
      console.log("💾 Successfully saved cameras to database!");
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
