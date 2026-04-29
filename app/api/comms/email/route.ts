// app/api/comms/email/route.ts
// General-purpose email sender via Resend.
// Supports named templates + custom subject/body.
// Logs every send to emails_sent table.
//
// Body: { to, template, siteName, operatorName, alarmId?, patrolLogId?,
//         notes?, priority?, customSubject?, customBody? }

import { NextResponse } from 'next/server';
import { Resend }       from 'resend';
import { createClient } from '@supabase/supabase-js';

// Use verified custom domain if available; fall back to Resend's shared
// domain so emails keep working while ggsoc.com is being verified.
// Once resend.com/domains shows ggsoc.com as Verified, remove the fallback.
const DOMAIN_VERIFIED = process.env.RESEND_DOMAIN_VERIFIED === 'true';
const FROM_EMAIL = DOMAIN_VERIFIED
  ? 'GateGuard SOC <soc@ggsoc.com>'
  : 'GateGuard SOC <onboarding@resend.dev>';
const OPS_EMAIL  = 'rfeldman@gateguard.co';

// ─── Email templates ──────────────────────────────────────────────────────────
function buildEmail(
  template: string,
  ctx: {
    siteName:     string;
    operatorName: string;
    alarmId:      string;
    notes:        string;
    priority:     string;
    ts:           string;
    customSubject?: string;
    customBody?:   string;
  }
): { subject: string; html: string } {
  const { siteName, operatorName, alarmId, notes, priority, ts } = ctx;

  const header = (title: string, color = '#dc2626') => `
    <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0;border-bottom:3px solid ${color};">
      <p style="margin:0;color:#f1f5f9;font-size:18px;font-weight:700;">${title}</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">GateGuard Security Operations Center · ${ts} EST</p>
    </div>`;

  const table = (rows: [string, string][]) => `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
      ${rows.map(([k, v]) => `
        <tr>
          <td style="padding:6px 0;color:#64748b;width:160px;vertical-align:top;">${k}</td>
          <td style="padding:6px 0;font-weight:600;">${v}</td>
        </tr>`).join('')}
    </table>`;

  const notesBlock = notes ? `
    <div style="margin-top:16px;padding:12px;background:#fef9c3;border:1px solid #fde68a;border-radius:6px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.05em;">Operator Notes</p>
      <p style="margin:0;font-size:13px;color:#451a03;">${notes}</p>
    </div>` : '';

  const footer = `<p style="margin-top:20px;font-size:11px;color:#94a3b8;">This is an automated notification from GateGuard SOC. Do not reply to this email.</p>`;

  const wrap = (inner: string) => `
    <div style="font-family:sans-serif;color:#1a1a2e;max-width:600px;">
      ${inner}
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        ${table([['Site', siteName], ['Operator', operatorName], ['Time', ts], ['Alarm Ref', alarmId.slice(0, 8)]])}
        ${notesBlock}
        ${footer}
      </div>
    </div>`;

  switch (template) {
    case 'incident_report':
      return {
        subject: `[GateGuard] Incident Report — ${siteName}`,
        html: wrap(header(`📋 Incident Report — ${siteName}`, '#4f46e5') + `
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
            ${table([['Site', siteName], ['Priority', priority || '—'], ['Operator', operatorName], ['Time', ts], ['Alarm Ref', alarmId.slice(0, 8)]])}
            ${notesBlock}
            ${footer}
          </div>`),
      };

    case 'gate_service':
      return {
        subject: `[GateGuard] Gate/Door Service Needed — ${siteName}`,
        html: wrap(header('⚠ Gate / Door Service Needed', '#d97706')),
      };

    case 'check_in':
      return {
        subject: `[GateGuard] Security Check-In — ${siteName}`,
        html: wrap(header(`✓ Patrol Check-In — ${siteName}`, '#16a34a')),
      };

    case 'all_clear':
      return {
        subject: `[GateGuard] All Clear — ${siteName}`,
        html: wrap(header(`✅ All Clear — ${siteName}`, '#16a34a')),
      };

    case 'custom':
      return {
        subject: ctx.customSubject ?? `[GateGuard] Message — ${siteName}`,
        html: ctx.customBody
          ? `<div style="font-family:sans-serif;max-width:600px;">${ctx.customBody}</div>`
          : wrap(header(`GateGuard SOC — ${siteName}`, '#6366f1')),
      };

    default:
      return {
        subject: `[GateGuard] Security Notification — ${siteName}`,
        html: wrap(header(`GateGuard Security — ${siteName}`, '#6366f1')),
      };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const {
      to,
      template      = 'incident_report',
      siteName      = '',
      operatorName  = 'GateGuard SOC',
      alarmId       = '',
      patrolLogId   = null,
      operatorId    = null,
      notes         = '',
      priority      = '',
      customSubject = '',
      customBody    = '',
      ccOps         = false,   // if true, always CC rfeldman@gateguard.co
    } = await request.json();

    if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[comms/email] RESEND_API_KEY not set');
      return NextResponse.json({ sent: false, reason: 'no_api_key' });
    }

    const resend = new Resend(apiKey);
    const ts = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
    });

    const { subject, html } = buildEmail(template, {
      siteName, operatorName, alarmId, notes, priority, ts, customSubject, customBody,
    });

    const toList: string[] = Array.isArray(to) ? to : [to];
    if (ccOps && !toList.includes(OPS_EMAIL)) toList.push(OPS_EMAIL);

    const { data, error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      toList,
      subject,
      html,
    });

    if (error) {
      console.error('[comms/email] Resend error:', error);
      return NextResponse.json({ sent: false, error: error.message }, { status: 500 });
    }

    // Log
    await supabase.from('emails_sent').insert({
      alarm_id:     alarmId   || null,
      patrol_log_id: patrolLogId,
      operator_id:  operatorId,
      operator_name: operatorName,
      to_email:     toList.join(', '),
      subject,
      template,
      resend_id:    data?.id ?? null,
      site_name:    siteName,
    });

    return NextResponse.json({ sent: true, id: data?.id });
  } catch (err: any) {
    console.error('[comms/email]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
