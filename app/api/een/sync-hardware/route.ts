import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    // 1. Get credentials for this specific site from Supabase
    const { token, cluster } = await getValidEENToken(siteId);

    // 2. Discovery: Get all cameras owned by this account
    const response = await fetch(`https://${cluster}/api/v3.0/cameras`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const cameras = await response.json();

    // 3. Map & Store: Link these ESNs to the Site ID in our 'cameras' table
    const cameraMappings = cameras.map((cam: any) => ({
      site_id: siteId,
      een_esn: cam.esn,
      name: cam.name,
      status: cam.status,
      // We store the raw EEN object in a jsonb column for future-proofing
      metadata: cam 
    }));

    const { error } = await supabase
      .from('cameras')
      .upsert(cameraMappings, { onConflict: 'een_esn' });

    if (error) throw error;

    return NextResponse.json({ message: `Successfully synced ${cameras.length} cameras for Marbella.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
