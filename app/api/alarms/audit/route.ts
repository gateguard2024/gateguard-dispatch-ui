import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Fire-and-forget: tell the GateGuard Portal to mark the bridged incident resolved.
async function bridgeResolveToPortal(alarmId: string, note: string, action: string) {
  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.gateguard.co';
  try {
    await fetch(`${portalUrl}/api/incidents/ingest`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_ext_id:   alarmId,
        source_system:   'ggsoc',
        resolution_note: note || action || 'Resolved by GGSOC operator',
        resolved_by:     'GGSOC Operator',
      }),
    });
    console.log(`[alarms/audit] 🔗 Portal bridge: alarm ${alarmId} marked resolved`);
  } catch (err: any) {
    console.error(`[alarms/audit] Portal bridge failed for alarm ${alarmId}:`, err.message);
  }
}

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

  // Bridge resolution to Portal incidents page (non-blocking)
  void bridgeResolveToPortal(alarmId, note, action);

  return NextResponse.json({ success: true });
}
