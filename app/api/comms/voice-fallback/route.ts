// app/api/comms/voice-fallback/route.ts
// Called by Twilio after <Dial> completes (any outcome).
// If no one answered (DialCallStatus = no-answer | busy), we automatically
// place a NEW outbound call to the same number to leave a voicemail message.
//
// Callback number in message: 1-844-469-4283 ext 900

import { NextResponse }                    from 'next/server';
import { getTwilioClient, TWILIO_CALLER, TWILIO_FROM } from '@/lib/twilio';

const CALLBACK_NUMBER = '1-844-469-4283';
const CALLBACK_EXT    = '900';

// TwiML played when the called party's voicemail picks up our second call
function voicemailTwiML(siteName: string): string {
  const site = siteName ? ` regarding ${siteName}` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="2"/>
  <Say voice="Polly.Joanna" language="en-US">
    Hello. This is GateGuard Security Operations contacting you${site}.
    Our security team has noted an event at your property and an operator is standing by.
    Please return our call at ${CALLBACK_NUMBER}, extension ${CALLBACK_EXT}.
    Again, that number is ${CALLBACK_NUMBER}, extension ${CALLBACK_EXT}.
    Thank you. Have a great day.
  </Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
}

export async function POST(request: Request) {
  const form         = await request.formData();
  const dialStatus   = (form.get('DialCallStatus') as string | null) ?? '';
  const to           = new URL(request.url).searchParams.get('to') ?? '';  // passed via action URL
  const siteName     = (form.get('Site') as string | null) ?? '';

  // Only auto-voicemail on genuine no-answer outcomes
  const shouldVoicemail = ['no-answer', 'busy', 'failed'].includes(dialStatus);

  if (shouldVoicemail && to) {
    try {
      const client = getTwilioClient();
      await client.calls.create({
        to,
        from:  TWILIO_CALLER || TWILIO_FROM,
        twiml: voicemailTwiML(siteName),
      });
      console.log(`[voice-fallback] Voicemail call dispatched to ${to} (DialStatus: ${dialStatus})`);
    } catch (err: any) {
      console.error('[voice-fallback] Voicemail call failed:', err.message);
    }
  }

  // Return empty response — the browser call ends cleanly
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
