// app/api/reports/send-email/route.ts
//
// Sends a GateGuard incident report or one-off email via Resend,
// then logs the send to the emails_sent table.
//
// POST /api/reports/send-email
// Body: {
//   templateType: 'incident_report' | 'gate_stuck_site' | 'gate_stuck_ops' | 'one_off'
//   priority:     'P1' | 'P2' | 'P3' | 'P4' | null
//   subject:      string
//   htmlBody:     string         — fully rendered HTML
//   recipients:   { name: string; email: string; role?: string }[]
//   agentEmail:   string
//   agentName:    string
//   incidentId:   string | null
//   patrolId:     string | null
//   zoneId:       string | null
//   bodyPreview:  string | null  — first 500 chars for the log timeline
// }
// Returns: { success: boolean; messageId?: string; error?: string }

import { NextResponse } from 'next/server';
import { Resend }       from 'resend';
import { createClient } from '@supabase/supabase-js';

type TemplateType = 'incident_report' | 'gate_stuck_site' | 'gate_stuck_ops' | 'one_off';

export async function POST(request: Request) {
  try {
    const {
      templateType,
      priority,
      subject,
      htmlBody,
      recipients,
      agentEmail,
      agentName,
      incidentId,
      patrolId,
      zoneId,
      bodyPreview,
    }: {
      templateType: TemplateType;
      priority:     string | null;
      subject:      string;
      htmlBody:     string;
      recipients:   { name: string; email: string; role?: string }[];
      agentEmail:   string;
      agentName:    string;
      incidentId:   string | null;
      patrolId:     string | null;
      zoneId:       string | null;
      bodyPreview:  string | null;
    } = await request.json();

    if (!subject || !htmlBody || !recipients?.length || !agentEmail) {
      return NextResponse.json(
        { error: 'subject, htmlBody, recipients, and agentEmail required' },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendKey);

    // Build Resend to array
    const toAddresses = recipients.map(r =>
      r.name ? `${r.name} <${r.email}>` : r.email
    );

    const { data: resendData, error: resendError } = await resend.emails.send({
      from:    `GateGuard Dispatch <dispatch@gateguard.co>`,
      to:      toAddresses,
      replyTo: agentEmail,
      subject,
      html:    htmlBody,
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Log the send regardless of success/failure
    await supabase.from('emails_sent').insert({
      incident_id:       incidentId ?? null,
      patrol_id:         patrolId   ?? null,
      zone_id:           zoneId     ?? null,
      agent_email:       agentEmail,
      template_type:     templateType,
      priority:          priority   ?? null,
      recipients:        recipients,
      subject,
      body_preview:      bodyPreview ? bodyPreview.slice(0, 500) : null,
      resend_message_id: resendData?.id ?? null,
      status:            resendError ? 'failed' : 'sent',
      error_message:     resendError ? resendError.message : null,
    });

    // If this was an incident report, stamp the incident_reports row
    if (templateType === 'incident_report' && incidentId && !resendError) {
      await supabase
        .from('incident_reports')
        .update({
          email_sent_at:    new Date().toISOString(),
          email_recipients: recipients,
        })
        .eq('id', incidentId);
    }

    if (resendError) {
      console.error('[send-email] Resend error:', resendError);
      return NextResponse.json({ success: false, error: resendError.message });
    }

    return NextResponse.json({ success: true, messageId: resendData?.id });
  } catch (err) {
    console.error('[send-email] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
