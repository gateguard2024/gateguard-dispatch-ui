import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    // 1. Get credentials and token for this specific site
    const { token, cluster } = await getValidEENToken(siteId);

    // 2. Fetch the hardware list from EEN
    const response = await fetch(`https://${cluster}/api/v3.0/cameras`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const cameras = await response.json();

    // 3. Map to our database. We link each ESN to the siteId.
    const cameraRows = cameras.map((cam: any) => ({
      site_id: siteId,
      een_esn: cam.esn,
      name: cam.name,
      status: cam.status
    }));

    // Upsert means: "If the ESN is new, add it. If it exists, update the name/status."
    const { error } = await supabase
      .from('cameras')
      .upsert(cameraRows, { onConflict: 'een_esn' });

    if (error) throw error;

    return NextResponse.json({ message: `Synced ${cameras.length} cameras for Site ${siteId}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
