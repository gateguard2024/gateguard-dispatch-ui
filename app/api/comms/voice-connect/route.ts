// app/api/comms/voice-connect/route.ts
// TwiML App webhook — called by Twilio when the browser Device.connect() fires.
// Returns <Dial> TwiML to bridge the browser call to the target phone number.
//
// answerOnBridge="true"  → browser ringing stops when the called party answers
// action                 → called when Dial completes; used to trigger voicemail fallback
// timeout                → 25 s ring before treating as no-answer
//
// This URL must be set as the "Voice URL" in your TwiML App:
//   Twilio Console → Voice → TwiML Apps → your app → Voice URL
//   URL: https://YOUR_APP_URL/api/comms/voice-connect  (POST)

import { TWILIO_CALLER, TWILIO_FROM } from '@/lib/twilio';

export async function POST(request: Request) {
  const form = await request.formData();

  // Custom param sent by Device.connect({ params: { To: '+1XXX' } })
  const to = (form.get('To') as string | null)?.trim() ?? '';

  if (!to) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="Polly.Joanna">No destination number provided.</Say></Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Caller ID presented to the called party (verified 844 number)
  const callerId = TWILIO_CALLER || TWILIO_FROM;

  // Pass the dialed number into the fallback URL so it can leave a voicemail
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const fallbackUrl = appUrl
    ? `${appUrl}/api/comms/voice-fallback?to=${encodeURIComponent(to)}`
    : '';

  const actionAttr = fallbackUrl ? ` action="${fallbackUrl}"` : '';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" callerId="${callerId}" timeout="25"${actionAttr}>
    <Number>${to}</Number>
  </Dial>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
