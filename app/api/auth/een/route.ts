import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();
    const { token, cluster } = await getValidEENToken(siteId);

    const response = await fetch(`https://${cluster}/api/v3.0/cameras`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const cameras = await response.json();

   const cameraRows = cameras.map((cam: any) => ({
  site_id: siteId,
  een_esn: cam.esn,
  name: cam.name,
  status: cam.status,
  metadata: cam // Store the full EEN response here just in case
}));

    await supabase.from('cameras').upsert(cameraRows, { onConflict: 'een_esn' });

    return NextResponse.json({ success: true, count: cameras.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
