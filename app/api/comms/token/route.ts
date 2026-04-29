// app/api/comms/token/route.ts
// Issues a short-lived Twilio Access Token with a Voice Grant so the
// browser can initialize the Twilio Voice SDK (WebRTC dialer).
//
// Required env vars:
//   TWILIO_ACCOUNT_SID      — AC...
//   TWILIO_API_KEY          — SK...   (create in Console → API Keys)
//   TWILIO_API_SECRET       — the secret shown once when you create the API Key
//   TWILIO_TWIML_APP_SID    — AP...   (create in Console → TwiML Apps, Voice URL = /api/comms/voice-connect)

import { NextResponse } from 'next/server';
import twilio           from 'twilio';

const { AccessToken } = twilio.jwt;
const { VoiceGrant }  = AccessToken;

export async function GET() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey     = process.env.TWILIO_API_KEY;
  const apiSecret  = process.env.TWILIO_API_SECRET;
  const appSid     = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !appSid) {
    console.warn('[comms/token] Missing Twilio Voice SDK env vars');
    return NextResponse.json(
      { error: 'Twilio Voice SDK not configured — set TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID' },
      { status: 503 }
    );
  }

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    ttl:      3600,           // 1-hour token
    identity: 'ggsoc-operator',
  });

  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow:          false,   // SOC never receives inbound browser calls
  }));

  return NextResponse.json({ token: token.toJwt() });
}
