// app/api/twilio/status/route.ts
//
// Twilio StatusCallback webhook — fired when a call ends.
// Updates the calls row with duration, outcome, recording URL,
// then triggers the AI summary generation.
//
// Configure in Twilio console: StatusCallback = https://<domain>/api/twilio/status
// POST body is application/x-www-form-urlencoded from Twilio

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body        = await request.formData();
    const callSid     = body.get('CallSid')       as string;
    const callStatus  = body.get('CallStatus')    as string; // completed, no-answer, busy, failed
    const duration    = body.get('CallDuration')  as string; // seconds
    const recordingUrl = body.get('RecordingUrl') as string | null;
    // Custom param we pass when creating the TwiML — the Supabase call log ID
    const callLogId   = body.get('callLogId')     as string | null;

    if (!callSid) {
      return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Map Twilio status to our outcome enum
    const outcomeMap: Record<string, string> = {
      completed: 'answered',
      'no-answer': 'no-answer',
      busy:   'busy',
      failed: 'failed',
    };
    const outcome = outcomeMap[callStatus] ?? callStatus;

    // Update by callLogId if we have it, otherwise fall back to twilio_call_sid
    const updatePayload: Record<string, unknown> = {
      twilio_call_sid:  callSid,
      outcome,
      duration_seconds: duration ? parseInt(duration, 10) : null,
      recording_url:    recordingUrl ?? null,
    };

    let query = supabase.from('calls').update(updatePayload);
    if (callLogId) {
      query = query.eq('id', callLogId);
    } else {
      query = query.eq('twilio_call_sid', callSid);
    }

    const { data: updatedRow } = await query.select('id, incident_id, patrol_id, agent_email').single();

    // Trigger AI summary for answered calls with recordings
    if (outcome === 'answered' && recordingUrl && updatedRow) {
      // Fire-and-forget — don't block the webhook response
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/call-summary`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          callLogId:    updatedRow.id,
          recordingUrl: recordingUrl + '.mp3',
          agentEmail:   updatedRow.agent_email,
        }),
      }).catch(err => console.error('[twilio/status] call-summary trigger failed:', err));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[twilio/status] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
