// app/api/comms/email/route.ts
// General-purpose email sender via Resend.
// Uses the official GateGuard Incident Report format as the base for all templates.
// Template mirrors: https://docs.google.com/document/d/1_a_uflKFHcOFlMPfSdCnLF9tItrNhZT-hEyrd-i5Czo
//
// Body: { to, template, siteName, operatorName, alarmId?, patrolLogId?,
//         notes?, priority?, incidentType?, location?, subjects?,
//         customSubject?, customBody?, ccOps? }

import { NextResponse } from 'next/server';
import { Resend }       from 'resend';
import { createClient } from '@supabase/supabase-js';

const DOMAIN_VERIFIED = process.env.RESEND_DOMAIN_VERIFIED === 'true';
const FROM_EMAIL = DOMAIN_VERIFIED
  ? 'GateGuard SOC <soc@ggsoc.com>'
  : 'GateGuard SOC <onboarding@resend.dev>';
const OPS_EMAIL  = 'rfeldman@gateguard.co';

const SOC_PHONE   = '(844) 469-4283';
const SOC_ADDRESS = '980 Hammond Dr NE, Atlanta, GA 30328';
const SOC_WEBSITE = 'ggsoc.com';

// ─── Priority label map ────────────────────────────────────────────────────────
const PRIORITY_LABEL: Record<string, string> = {
  P1: 'P1 — Severe',
  P2: 'P2 — Moderate',
  P3: 'P3 — Low',
  P4: 'P4 — Informational',
};

// ─── Shared GateGuard report HTML builder ────────────────────────────────────
function buildReportHtml(ctx: {
  reportTitle:   string;     // e.g. "Illegal Dumping Notification"
  status:        string;     // Active / Closed / Dispatched
  severity:      string;     // P1 — Severe / P2 — Moderate / etc.
  property:      string;     // siteName
  detectionTime: string;     // formatted timestamp
  incidentType:  string;
  location:      string;
  subjects:      string;
  narrative:     string;     // notes
  policeDispatch: string;    // Yes / No
  internalAlert:  string;
  footageLink:   string;
  operatorName:  string;
  alarmRef:      string;
  accentColor:   string;
}): string {
  const {
    reportTitle, status, severity, property, detectionTime,
    incidentType, location, subjects, narrative,
    policeDispatch, internalAlert, footageLink,
    operatorName, alarmRef, accentColor,
  } = ctx;

  // ── Shared styles ────────────────────────────────────────────────────────
  const bodyStyle  = 'font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;max-width:640px;margin:0 auto;';
  const th         = `style="background:#0f172a;color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 12px;text-align:left;border:1px solid #1e293b;"`;
  const td         = `style="padding:8px 12px;font-size:13px;border:1px solid #e2e8f0;vertical-align:top;"`;
  const tdLabel    = `style="padding:8px 12px;font-size:13px;font-weight:700;border:1px solid #e2e8f0;background:#f8fafc;width:200px;vertical-align:top;"`;
  const sectionHdr = (text: string) =>
    `<tr><td colspan="2" style="padding:10px 12px;font-size:11px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;background:#0f172a;color:${accentColor};border:1px solid #1e293b;">${text}</td></tr>`;

  return `
<div style="${bodyStyle}">

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- HEADER                                                                 -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <div style="background:#0f172a;padding:24px;border-radius:8px 8px 0 0;border-bottom:4px solid ${accentColor};">
    <p style="margin:0 0 6px;color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
      Gate Guard Security Operations Center
    </p>
    <p style="margin:0 0 2px;color:#f1f5f9;font-size:22px;font-weight:900;letter-spacing:-0.02em;">
      INCIDENT REPORT
    </p>
    <p style="margin:0;color:#64748b;font-size:12px;">${reportTitle}</p>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- REPORT META ROW                                                        -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <table style="width:100%;border-collapse:collapse;border:1px solid #1e293b;background:#0f172a;">
    <tr>
      <td style="padding:8px 12px;font-size:10px;color:#64748b;border-right:1px solid #1e293b;width:33%;">
        <span style="display:block;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;">Report ID</span>
        #INC-${alarmRef || 'SOC'}
      </td>
      <td style="padding:8px 12px;font-size:10px;color:#64748b;border-right:1px solid #1e293b;width:33%;">
        <span style="display:block;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;">Date &amp; Time</span>
        ${detectionTime} ET
      </td>
      <td style="padding:8px 12px;font-size:10px;color:#64748b;width:33%;">
        <span style="display:block;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;">Prepared by</span>
        Gate Guard SOC
      </td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- SITREP                                                                 -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    <tr>
      <td ${th}>Status</td>
      <td ${th}>Severity</td>
      <td ${th}>Property</td>
      <td ${th}>Detection Time</td>
    </tr>
    <tr>
      <td style="padding:10px 12px;font-size:13px;font-weight:700;border:1px solid #e2e8f0;color:${accentColor};">${status}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:700;border:1px solid #e2e8f0;">${severity}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:700;border:1px solid #e2e8f0;">${property}</td>
      <td style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;">${detectionTime} ET</td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- INCIDENT OVERVIEW                                                      -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <div style="margin-top:16px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#374151;">Incident Overview</p>
    <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">
      The Gate Guard SOC (Security Operations Center) identified an event via high-definition camera monitoring
      at <strong>${property}</strong>. Immediate protocols were enacted and the following data has been
      synchronized from the SOC Command Portal.
    </p>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- INTELLIGENCE & EVIDENCE                                                -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    ${sectionHdr('Intelligence &amp; Evidence')}
    <tr><td ${tdLabel}>Incident Type</td><td ${td}>${incidentType}</td></tr>
    <tr><td ${tdLabel}>Specific Location</td><td ${td}>${location || '—'}</td></tr>
    <tr><td ${tdLabel}>Subject(s) Intel</td><td ${td}>${subjects || '—'}</td></tr>
    ${narrative ? `<tr><td ${tdLabel}>Incident Narrative</td><td ${td}>${narrative}</td></tr>` : ''}
  </table>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- OPERATIONAL RESPONSE                                                   -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    ${sectionHdr('Operational Response')}
    <tr><td ${tdLabel}>Police Dispatch</td><td ${td}>${policeDispatch}</td></tr>
    <tr><td ${tdLabel}>Internal Alerting</td><td ${td}>${internalAlert}</td></tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- DIGITAL EVIDENCE                                                       -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    ${sectionHdr('Digital Evidence &amp; Attachments')}
    <tr>
      <td ${th} style="width:50%;">Cloud Footage</td>
      <td ${th}>Evidence Snapshots</td>
    </tr>
    <tr>
      <td ${td}>${footageLink || 'Available in SOC Command Portal'}</td>
      <td ${td}>See attached / SOC Portal</td>
    </tr>
  </table>
  <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;font-style:italic;">
    All digital evidence is stored in accordance with the Gate Guard Privacy and Security Policy.
    This report is confidential — if received in error, notify Gate Guard immediately and delete the contents.
  </p>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- DISPATCHER SIGN-OFF                                                    -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <table style="width:100%;border-collapse:collapse;margin-top:20px;">
    ${sectionHdr('Dispatcher Sign-Off')}
    <tr><td ${tdLabel}>Dispatcher Name / ID</td><td ${td}>${operatorName}</td></tr>
    <tr><td ${tdLabel}>Unit</td><td ${td}>Gate Guard SOC Command Center</td></tr>
    <tr><td ${tdLabel}>Contact</td><td ${td}>${SOC_PHONE} | ${SOC_WEBSITE}</td></tr>
    <tr><td ${tdLabel}>Address</td><td ${td}>${SOC_ADDRESS}</td></tr>
    <tr><td ${tdLabel}>Support</td><td ${td}>${SOC_PHONE}</td></tr>
  </table>

  <!-- Sign-off line -->
  <div style="margin-top:20px;padding:16px;border-top:2px solid ${accentColor};text-align:center;">
    <p style="margin:0;font-size:12px;color:#374151;">
      Sincerely, <strong>${operatorName}</strong> — Gate Guard SOC Command Center | ${SOC_WEBSITE}
    </p>
    <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;">
      This is an automated notification from Gate Guard SOC. Do not reply to this email.
    </p>
  </div>

</div>`;
}

// ─── Template builder ─────────────────────────────────────────────────────────
function buildEmail(
  template: string,
  ctx: {
    siteName:      string;
    operatorName:  string;
    alarmId:       string;
    notes:         string;
    priority:      string;
    ts:            string;
    incidentType?: string;
    location?:     string;
    subjects?:     string;
    customSubject?: string;
    customBody?:   string;
  }
): { subject: string; html: string } {
  const {
    siteName, operatorName, alarmId, notes, priority, ts,
    incidentType = '', location = '', subjects = '',
  } = ctx;

  const alarmRef      = alarmId ? alarmId.slice(0, 8).toUpperCase() : 'SOC';
  const severityLabel = PRIORITY_LABEL[priority] ?? (priority || 'P3 — Low');

  switch (template) {

    // ── Incident Report ──────────────────────────────────────────────────────
    case 'incident_report':
      return {
        subject: `[GateGuard] Incident Report — ${siteName}`,
        html: buildReportHtml({
          reportTitle:    'Security Incident Notification',
          status:         'Closed',
          severity:       severityLabel,
          property:       siteName,
          detectionTime:  ts,
          incidentType:   incidentType || 'Security Event (Camera Detection)',
          location,
          subjects,
          narrative:      notes,
          policeDispatch: 'No — Contact site management if required',
          internalAlert:  'On-site security and property management notified via Gate Guard SOC Portal.',
          footageLink:    '',
          operatorName,
          alarmRef,
          accentColor:    '#4f46e5',
        }),
      };

    // ── Gate / Door Service ──────────────────────────────────────────────────
    case 'gate_service':
      return {
        subject: `[GateGuard] Gate/Door Service Needed — ${siteName}`,
        html: buildReportHtml({
          reportTitle:    'Gate / Door Service Required',
          status:         'Action Required',
          severity:       'P3 — Maintenance',
          property:       siteName,
          detectionTime:  ts,
          incidentType:   'Gate / Door Malfunction or Service Flag',
          location:       location || 'See site gate inventory',
          subjects:       '—',
          narrative:      notes || 'A gate or door at this property has been flagged as requiring service. Please coordinate with maintenance.',
          policeDispatch: 'No',
          internalAlert:  'Property management notified. Gate status logged in GateGuard SOC Portal.',
          footageLink:    '',
          operatorName,
          alarmRef,
          accentColor:    '#d97706',
        }),
      };

    // ── Patrol Check-In ──────────────────────────────────────────────────────
    case 'check_in':
      return {
        subject: `[GateGuard] Patrol Check-In — ${siteName}`,
        html: buildReportHtml({
          reportTitle:    'Scheduled Patrol Check-In',
          status:         'Active',
          severity:       'P4 — Informational',
          property:       siteName,
          detectionTime:  ts,
          incidentType:   'Routine Patrol',
          location:       'Full property perimeter',
          subjects:       '—',
          narrative:      notes || 'Patrol officer has checked in at this property. No issues noted at time of check-in.',
          policeDispatch: 'No',
          internalAlert:  'Check-in logged in GateGuard SOC Patrol Portal.',
          footageLink:    '',
          operatorName,
          alarmRef,
          accentColor:    '#16a34a',
        }),
      };

    // ── All Clear ────────────────────────────────────────────────────────────
    case 'all_clear':
      return {
        subject: `[GateGuard] All Clear — ${siteName}`,
        html: buildReportHtml({
          reportTitle:    'All Clear — Patrol Complete',
          status:         'Closed',
          severity:       'P4 — Informational',
          property:       siteName,
          detectionTime:  ts,
          incidentType:   'Routine Patrol — Completion',
          location:       'Full property perimeter',
          subjects:       '—',
          narrative:      notes || 'Patrol has been completed. The property is clear with no incidents to report.',
          policeDispatch: 'No',
          internalAlert:  'All-clear logged in GateGuard SOC Portal.',
          footageLink:    '',
          operatorName,
          alarmRef,
          accentColor:    '#16a34a',
        }),
      };

    // ── Custom ───────────────────────────────────────────────────────────────
    case 'custom':
      if (ctx.customBody) {
        return {
          subject: ctx.customSubject ?? `[GateGuard] Message — ${siteName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">${ctx.customBody}</div>`,
        };
      }
      return {
        subject: ctx.customSubject ?? `[GateGuard] Message — ${siteName}`,
        html: buildReportHtml({
          reportTitle:    ctx.customSubject || 'Security Notification',
          status:         'Informational',
          severity:       severityLabel || 'P4 — Informational',
          property:       siteName,
          detectionTime:  ts,
          incidentType:   'Custom Notification',
          location,
          subjects:       '—',
          narrative:      notes,
          policeDispatch: '—',
          internalAlert:  'Notification dispatched via Gate Guard SOC Portal.',
          footageLink:    '',
          operatorName,
          alarmRef,
          accentColor:    '#6366f1',
        }),
      };

    // ── Default fallback ─────────────────────────────────────────────────────
    default:
      return {
        subject: `[GateGuard] Security Notification — ${siteName}`,
        html: buildReportHtml({
          reportTitle:    'Security Notification',
          status:         'Informational',
          severity:       severityLabel,
          property:       siteName,
          detectionTime:  ts,
          incidentType:   'Security Event',
          location,
          subjects:       '—',
          narrative:      notes,
          policeDispatch: '—',
          internalAlert:  'Notified via Gate Guard SOC Portal.',
          footageLink:    '',
          operatorName,
          alarmRef,
          accentColor:    '#6366f1',
        }),
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
      incidentType  = '',
      location      = '',
      subjects      = '',
      customSubject = '',
      customBody    = '',
      ccOps         = false,
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
      siteName, operatorName, alarmId, notes, priority, ts,
      incidentType, location, subjects, customSubject, customBody,
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

    await supabase.from('emails_sent').insert({
      alarm_id:      alarmId    || null,
      patrol_log_id: patrolLogId,
      operator_id:   operatorId,
      operator_name: operatorName,
      to_email:      toList.join(', '),
      subject,
      template,
      resend_id:     data?.id ?? null,
      site_name:     siteName,
    });

    return NextResponse.json({ sent: true, id: data?.id });
  } catch (err: any) {
    console.error('[comms/email]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
