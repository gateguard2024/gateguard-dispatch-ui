// app/api/comms/log/route.ts
// Saves a free-text operator note to manual_logs.
// GET also returns the log history for an alarm or patrol.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — save a new log entry
export async function POST(request: Request) {
  try {
    const {
      note,
      alarmId      = null,
      patrolLogId  = null,
      operatorId   = null,
      operatorName = 'Operator',
      siteName     = '',
    } = await request.json();

    if (!note?.trim()) {
      return NextResponse.json({ error: 'note is required' }, { status: 400 });
    }

    const { data, error } = await db().from('manual_logs').insert({
      alarm_id:      alarmId,
      patrol_log_id: patrolLogId,
      operator_id:   operatorId,
      operator_name: operatorName,
      note:          note.trim(),
      site_name:     siteName,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, entry: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — fetch log history for an alarm or patrol
export async function GET(request: NextRequest) {
  const alarmId     = request.nextUrl.searchParams.get('alarmId');
  const patrolLogId = request.nextUrl.searchParams.get('patrolLogId');

  if (!alarmId && !patrolLogId) {
    return NextResponse.json({ error: 'alarmId or patrolLogId required' }, { status: 400 });
  }

  let q = db().from('manual_logs').select('*').order('created_at', { ascending: false });
  if (alarmId)     q = q.eq('alarm_id', alarmId);
  if (patrolLogId) q = q.eq('patrol_log_id', patrolLogId);

  const { data, error } = await q.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}
