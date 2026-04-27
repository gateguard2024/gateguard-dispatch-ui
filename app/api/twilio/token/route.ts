// app/api/twilio/token/route.ts
//
// Generates a short-lived Twilio Access Token so the browser-based
// Twilio Voice SDK can place outbound calls without exposing credentials.
//
// Called by: GET /api/twilio/token
// Returns:   { token: string }

import { NextResponse } from 'next/server';
import twilio           from 'twilio';

const AccessToken  = twilio.jwt.AccessToken;
const VoiceGrant   = AccessToken.VoiceGrant;

export async function GET() {
  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid    = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid  = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    return NextResponse.json(
      { error: 'Twilio env vars not configured' },
      { status: 500 }
    );
  }

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity: 'gateguard-agent',
    ttl:      3600, // 1 hour
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow:          false, // dispatch only places calls, doesn't receive
  });

  token.addGrant(voiceGrant);

  return NextResponse.json({ token: token.toJwt() });
}
