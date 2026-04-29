// app/api/comms/call/route.ts
// Initiates an outbound Twilio call to a site contact.
// The call plays a notification message then hangs up.
// Both the call attempt and Twilio SID are logged to the `calls` table.
//
// Body: { toNumber, siteName, alarmId?, patrolLogId?, operatorId?, operatorName?, notes? }

import { NextResponse }               from 'next/server';
import { createClient }               from '@supabase/supabase-js';
import { getTwilioClient, TWILIO_FROM, TWILIO_CALLER } from '@/lib/twilio';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const {
      toNumber,
      siteName     = 'your property',
      alarmId      = null,
      patrolLogId  = null,
      operatorId   = null,
      operatorName = 'GateGuard SOC',
      notes        = '',
    } = await request.json();

    if (!toNumber) {
      return NextResponse.json({ error: 'toNumber is required' }, { status: 400 });
    }

    if (!TWILIO_FROM) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 });
    }

    const client = getTwilioClient();

    // TwiML webhook URL — served by /api/comms/twiml
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? '';
    const twimlUrl = `${appUrl.startsWith('http') ? appUrl : `https://${appUrl}`}/api/comms/twiml`
      + `?site=${encodeURIComponent(siteName)}&alarm=${alarmId ?? ''}`;

    const call = await client.calls.create({
      to:     toNumber,
      from:   TWILIO_CALLER || TWILIO_FROM,
      url:    twimlUrl,
      // statusCallbackMethod omitted — add later for delivery receipts
    });

    // Log to DB
    await supabase.from('calls').insert({
      alarm_id:     alarmId,
      patrol_log_id: patrolLogId,
      operator_id:  operatorId,
      operator_name: operatorName,
      to_number:    toNumber,
      from_number:  TWILIO_FROM,
      caller_id:    TWILIO_CALLER || null,
      twilio_sid:   call.sid,
      status:       'initiated',
      site_name:    siteName,
      notes,
    });

    return NextResponse.json({ success: true, sid: call.sid });
  } catch (err: any) {
    console.error('[comms/call]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
