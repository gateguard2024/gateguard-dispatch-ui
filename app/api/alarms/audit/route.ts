import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  const { alarmId, siteId, note, action } = await request.json();

  await supabase.from('audit_logs').insert({
    alarm_id: alarmId,
    site_id: siteId,
    action_taken: action, // e.g., 'RESOLVED'
    operator_notes: note
  });

  // Mark alarm as resolved
  await supabase.from('alarms').update({ status: 'resolved' }).eq('id', alarmId);

  return NextResponse.json({ success: true });
}
