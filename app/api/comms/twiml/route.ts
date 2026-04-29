// app/api/comms/twiml/route.ts
// Twilio calls this webhook when the recipient answers.
// Returns TwiML that plays a professional notification message.
//
// Query params: ?site=&alarm=

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const site  = req.nextUrl.searchParams.get('site')  ?? 'your property';
  const alarm = req.nextUrl.searchParams.get('alarm') ?? '';

  // Clean site name for speech (remove special chars that confuse TTS)
  const siteSpeech = site.replace(/[&<>"']/g, ' ');
  const refSpeech  = alarm ? ` Reference number: ${alarm.slice(0, 8)}.` : '';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">
    Hello. This is GateGuard Security Operations contacting you about ${siteSpeech}.
    Our team has noted a security event at your site and an operator will follow up shortly.
    ${refSpeech}
    Please call us back if you have any questions.
    Thank you.
  </Say>
  <Pause length="1"/>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Twilio also posts to this URL for status callbacks — return 200
export async function POST() {
  return new NextResponse('', { status: 200 });
}
