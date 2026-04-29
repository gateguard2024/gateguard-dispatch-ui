// app/api/comms/call/route.ts
// Initiates an outbound Twilio call to a site contact.
//
// Uses INLINE TwiML — no webhook URL required.
// Twilio reads the TwiML directly from the call creation request,
// so the call works even if the app URL isn't publicly reachable.
//
// Body: { toNumber, siteName, alarmId?, patrolLogId?, operatorId?, operatorName?, notes? }

import { NextResponse }               from 'next/server';
import { createClient }               from '@supabase/supabase-js';
import { getTwilioClient, TWILIO_FROM, TWILIO_CALLER } from '@/lib/twilio';

// Build the voice message TwiML inline — no outbound webhook needed.
function buildTwiML(siteName: string): string {
  // Escape XML special chars in siteName
  const safe = siteName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Hello. This is GateGuard Security Operations contacting you regarding ${safe}.
    Our team has noted a security event at your property and an operator is standing by.
    Please call us back at your earliest convenience.
    Thank you.
  </Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
}

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
      return NextResponse.json({ error: 'Twilio not configured — check TWILIO_FROM_NUMBER env var' }, { status: 503 });
    }

    const client  = getTwilioClient();
    const twiml   = buildTwiML(siteName);

    // Use `twiml` param instead of `url` — inline TwiML, no webhook required.
    const call = await client.calls.create({
      to:    toNumber,
      from:  TWILIO_CALLER || TWILIO_FROM,
      twiml,
    });

    // Log to DB
    await supabase.from('calls').insert({
      alarm_id:      alarmId,
      patrol_log_id: patrolLogId,
      operator_id:   operatorId,
      operator_name: operatorName,
      to_number:     toNumber,
      from_number:   TWILIO_FROM,
      caller_id:     TWILIO_CALLER || null,
      twilio_sid:    call.sid,
      status:        'initiated',
      site_name:     siteName,
      notes,
    });

    return NextResponse.json({ success: true, sid: call.sid });
  } catch (err: any) {
    console.error('[comms/call]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
