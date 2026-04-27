// app/api/twilio/call/route.ts
//
// Logs a call record to Supabase when an agent initiates a call.
// The actual call is placed client-side via the Twilio Voice JS SDK.
// This route creates the DB row so the call_sid can be updated
// via the /api/twilio/status webhook when the call completes.
//
// POST /api/twilio/call
// Body: {
//   toNumber:   string
//   toName:     string
//   toRole:     string
//   agentEmail: string
//   incidentId: string | null
//   patrolId:   string | null
//   zoneId:     string | null
// }
// Returns: { callLogId: string }

import { NextResponse }  from 'next/server';
import { createClient }  from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const {
      toNumber, toName, toRole,
      agentEmail,
      incidentId, patrolId, zoneId,
    } = await request.json();

    if (!toNumber || !agentEmail) {
      return NextResponse.json(
        { error: 'toNumber and agentEmail required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('calls')
      .insert({
        incident_id:  incidentId ?? null,
        patrol_id:    patrolId   ?? null,
        zone_id:      zoneId     ?? null,
        agent_email:  agentEmail,
        to_number:    toNumber,
        to_name:      toName   ?? null,
        to_role:      toRole   ?? null,
        outcome:      'in-progress',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[twilio/call] insert error:', error);
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
    }

    return NextResponse.json({ callLogId: data.id });
  } catch (err) {
    console.error('[twilio/call] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
