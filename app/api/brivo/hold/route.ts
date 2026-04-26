// app/api/brivo/hold/route.ts
//
// POST  — Set a door hold-open override
// DELETE — Cancel the current hold-open override
//
// POST body:  { accountId, doorId, mode: 'indefinite' | 'until_time', endTime?: string }
// DELETE body: { accountId, doorId }
//
// Brivo endpoint: /schedules/change-state/{accessPointId}
// Requires header: Accept-version: 2.0

import { NextResponse }                            from 'next/server';
import { getValidBrivoToken, brivoPost, brivoDelete } from '@/lib/brivo';
import { createClient }                            from '@supabase/supabase-js';

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── POST — set hold open ──────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const {
      accountId,
      doorId,
      mode,        // 'indefinite' | 'until_time'
      endTime,     // ISO string — required when mode === 'until_time'
      operatorId   = 'unknown',
      operatorName = 'Operator',
    } = await request.json();

    if (!accountId || !doorId || !mode) {
      return NextResponse.json({ error: 'Missing accountId, doorId, or mode' }, { status: 400 });
    }

    if (mode === 'until_time' && !endTime) {
      return NextResponse.json({ error: 'endTime is required when mode is until_time' }, { status: 400 });
    }

    const { token, apiKey } = await getValidBrivoToken(accountId);

    const body: Record<string, any> = {
      behavior:    'UNLOCK',
      endTimeMode: mode === 'indefinite' ? 'INDEFINITE' : 'UNTIL_TIME',
    };
    if (mode === 'until_time') body.endTime = endTime;

    const result = await brivoPost(
      token, apiKey,
      `/schedules/change-state/${doorId}`,
      body,
      { 'Accept-version': '2.0' }
    );

    // Audit log
    const supabase = makeSupabase();
    await supabase.from('audit_logs').insert({
      account_id:  accountId,
      operator_id: operatorId,
      action:      'door_hold_open',
      details:     JSON.stringify({ doorId, operatorName, mode, endTime: endTime ?? null }),
      created_at:  new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      mode,
      endTime:           endTime ?? null,
      accessPointState:  result?.accessPointState  ?? null,
      scheduleOverride:  result?.scheduleOverride   ?? null,
    });

  } catch (err: any) {
    console.error('[brivo/hold POST]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE — cancel hold open ─────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const {
      accountId,
      doorId,
      operatorId   = 'unknown',
      operatorName = 'Operator',
    } = await request.json();

    if (!accountId || !doorId) {
      return NextResponse.json({ error: 'Missing accountId or doorId' }, { status: 400 });
    }

    const { token, apiKey } = await getValidBrivoToken(accountId);

    const result = await brivoDelete(
      token, apiKey,
      `/schedules/change-state/${doorId}`,
      { 'Accept-version': '2.0' }
    );

    // Audit log
    const supabase = makeSupabase();
    await supabase.from('audit_logs').insert({
      account_id:  accountId,
      operator_id: operatorId,
      action:      'door_hold_released',
      details:     JSON.stringify({ doorId, operatorName }),
      created_at:  new Date().toISOString(),
    });

    return NextResponse.json({
      success:          true,
      accessPointState: result?.accessPointState ?? null,
    });

  } catch (err: any) {
    console.error('[brivo/hold DELETE]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
