import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // 1. Unlock the Vault: Get the keys and cluster for this specific site
    const { data: site, error: dbError } = await supabase
      .from('sites')
      .select('id, een_access_token, een_api_key, een_cluster')
      .eq('id', siteId)
      .single();

    if (dbError || !site) {
      throw new Error(`Database error or site not found for ID: ${siteId}`);
    }

    // Security Check: Ensure we have all 3 required pieces of the puzzle
    if (!site.een_access_token) throw new Error("Missing Access Token. Must authenticate first.");
    if (!site.een_api_key) throw new Error("Missing API Key in database.");
    if (!site.een_cluster) throw new Error("Missing Cluster URL in database.");

    // 2. Call the Eagle Eye V3 Cameras Endpoint
    // We route this EXACTLY to the cluster where Marbella's cameras live
    const eenUrl = `https://${site.een_cluster}/api/v3.0/cameras`;

    console.log(`📡 Requesting cameras from: ${eenUrl}`);

    const eenResponse = await fetch(eenUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${site.een_access_token}`, // The VIP Wristband
        'x-api-key': site.een_api_key,                      // The Static Vault Key
        'Content-Type': 'application/json'
      }
    });

    if (!eenResponse.ok) {
      const errText = await eenResponse.text();
      // If we get a 401 Unauthorized here, the token expired and needs a refresh
      throw new Error(`Eagle Eye API rejected sync: ${eenResponse.status} - ${errText}`);
    }

    const cameraData = await eenResponse.json();
    
    // We log the raw payload to the server console so you can see exactly what EEN returns
    console.log("🎥 SUCCESS! Raw Camera Data Received:", JSON.stringify(cameraData).substring(0, 500) + "...");

    // (Next Step: We will write the logic to save these cameras into your Supabase 'cameras' table)

    return NextResponse.json({ 
      success: true, 
      count: cameraData.length || Object.keys(cameraData).length, 
      data: cameraData 
    });

  } catch (err: any) {
    console.error("❌ Hardware Sync Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
