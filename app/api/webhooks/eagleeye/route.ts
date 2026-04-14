import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase'; // Using the relative path to avoid Vercel build errors!

export async function POST(request: Request) {
  try {
    // 1. Catch the incoming JSON payload from Eagle Eye
    const payload = await request.json();
    
    // EEN might send a single object or an array of results. We normalize it here.
    const alertData = payload.results ? payload.results[0] : payload;

    // 2. Extract the critical data
    const cameraEsn = alertData.actorId; 
    const eventName = alertData.alertName || alertData.eventType || 'Unknown Event';
    const priorityLevel = alertData.priority === 0 ? 50 : alertData.priority; // Default to 50 if 0

    if (!cameraEsn) {
      return NextResponse.json({ error: 'No actorId (ESN) found in payload' }, { status: 400 });
    }

    // 3. Look up the Camera in our Supabase database
    const { data: cameraData, error: camError } = await supabase
      .from('cameras')
      .select('id, site_id')
      .eq('een_esn', cameraEsn)
      .single();

    if (camError || !cameraData) {
      console.warn(`Webhook caught for ESN ${cameraEsn}, but it is not mapped in our DB.`);
      return NextResponse.json({ message: 'Camera not mapped, ignoring.' }, { status: 200 });
    }

    // 4. Insert the Alarm into the Dispatch Queue
    const { error: alarmError } = await supabase
      .from('alarms')
      .insert({
        site_id: cameraData.site_id,
        camera_id: cameraData.id,
        status: 'pending',
        priority: priorityLevel,
        event_type: eventName,
      });

    if (alarmError) {
      console.error("Failed to insert alarm:", alarmError);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }

    // 5. Send a 200 OK back to Eagle Eye so they know we got it
    return NextResponse.json({ success: true, message: 'Alarm queued successfully' }, { status: 200 });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
