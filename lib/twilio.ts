// lib/twilio.ts
// Shared Twilio client + call helper
// Caller ID: TWILIO_CALLER_ID (verified 844) is shown to recipients.
// TWILIO_FROM_NUMBER (purchased Twilio number) handles routing if CALLER_ID unset.

import twilio from 'twilio';

export function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials not configured');
  return twilio(sid, token);
}

export const TWILIO_FROM   = process.env.TWILIO_FROM_NUMBER   ?? '';
export const TWILIO_CALLER = process.env.TWILIO_CALLER_ID     ?? process.env.TWILIO_FROM_NUMBER ?? '';
