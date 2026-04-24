// app/api/brivo/open/route.ts
//
// Remotely unlocks a Brivo access point (door/gate).
// Logs action to audit_logs with Clerk operator identity.
//
// POST body: { accountId, doorId, operatorId, operatorName, alarmId? }
// Response:  { success: true, door: { id, unlockedAt } }

import { NextResponse }                  from 'next/server';
import { createClient }                  from '@supabase/supabase-js';
import { getValidBrivoToken, brivoPost } from '@/lib/brivo';

export async function POST(request: Request) {
  try {
    const {
      accountId,
      doorId,
      operatorId   = 'unknown',
      operatorName = 'Operator',
      alarmId,
    } = await request.json();

    if (!accountId || !doorId) {
      return NextResponse.json({ error: 'Missing accountId or doorId' }, { status: 400 });
    }

    const { token, apiKey } = await getValidBrivoToken(accountId);

    console.log(`[brivo/open] Unlocking door ${doorId} by ${operatorName}`);

    // Brivo admin unlock = POST /access-points/{id}/activate (no body).
    // activationEnabled must be true on the access point in Brivo portal.
    // Note: /unlock is for digital-credential users only — not for admin use.
    await brivoPost(token, apiKey, `/access-points/${doorId}/activate`);

    const unlockedAt = new Date().toISOString();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('audit_logs').insert({
      account_id:  accountId,
      alarm_id:    alarmId ?? null,
      operator_id: operatorId,
      action:      'door_unlocked',
      details:     JSON.stringify({ doorId, operatorName, unlockedAt }),
      created_at:  unlockedAt,
    });

    console.log(`[brivo/open] ✅ Door ${doorId} unlocked by ${operatorName}`);
    return NextResponse.json({ success: true, door: { id: doorId, unlockedAt } });

  } catch (err: any) {
    console.error('[brivo/open]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
