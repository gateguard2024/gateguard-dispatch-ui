import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // EEN typically sends 'esn', 'desc' (event type), and 'timestamp'
    const { esn, desc, timestamp } = payload;

    // 1. Relational Lookup: Find the camera and its parent site
    const { data: camera, error: camError } = await supabase
      .from('cameras')
      .select('id, site_id, name')
      .eq('een_esn', esn)
      .single();

    // If the camera doesn't exist in our DB, we can't process the alarm.
    // This is why Step 1 (Sync) is so critical.
    if (camError || !camera) {
      console.error(`Webhook Received for unknown ESN: ${esn}`);
      return NextResponse.json({ error: "Unknown Camera ESN" }, { status: 404 });
    }

    // 2. Timestamp Conversion
    // EEN timestamps are often strings or numbers in ms. Convert to ISO for Postgres.
    const isoTimestamp = new Date(Number(timestamp)).toISOString();

    // 3. Create the Alarm record
    const { data: alarm, error: alarmError } = await supabase
      .from('alarms')
      .insert({
        site_id: camera.site_id,
        camera_id: camera.id,
        event_type: desc || 'Motion Detected',
        status: 'pending',
        event_timestamp: isoTimestamp, // THE KEY FOR THE PRE-ALARM CLIP
        priority: 100
      })
      .select()
      .single();

    if (alarmError) throw alarmError;

    // 4. Success Response
    return NextResponse.json({ 
      success: true, 
      alarmId: alarm.id,
      site: camera.site_id 
    });

  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
