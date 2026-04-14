import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) throw new Error("Missing siteId in request body");

    // 1. Get credentials for this specific site from Supabase
    // ⚠️ Ensure getValidEENToken also returns the 'apiKey' from your database!
    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    // 2. Discovery: Get all cameras owned by this account
    const response = await fetch(`https://${cluster}/api/v3.0/cameras`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-api-key': apiKey, // <-- CRITICAL FIX: The static API key is required
        'Content-Type': 'application/json'
      }
    });
    
    // ⚠️ CRITICAL FIX: Catch EEN rejection before trying to parse JSON
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Eagle Eye API Error (${response.status}): ${errText}`);
    }

    const cameras = await response.json();

    // 3. Map & Store: Link these ESNs to the Site ID in our 'cameras' table
    const cameraMappings = cameras.map((cam: any) => ({
      site_id: siteId,
      een_esn: cam.id || cam.esn, // Fallback to handle EEN API structure
      name: cam.name,
      status: cam.status || 'unknown',
      // We store the raw EEN object in a jsonb column for future-proofing
      metadata: cam 
    }));

    // 4. Save to Database
    const { error } = await supabase
      .from('cameras')
      .upsert(cameraMappings, { onConflict: 'een_esn' }); // Ensure 'een_esn' is UNIQUE in your DB!

    if (error) throw new Error(`Supabase Insert Error: ${error.message}`);

    // Dynamic success message
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
