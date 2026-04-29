import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// ── Service Notification — Gate / Door Service Needed ─────────────────────────
// Called when an alarm is resolved with action: gate_service_needed or
// door_service_needed. Sends dual emails: GateGuard ops + site contact.

const OPS_EMAIL   = 'rfeldman@gateguard.co';
const FROM_EMAIL  = 'GateGuard SOC <soc@gateguard.co>';
const SERVICE_LABELS: Record<string, string> = {
  gate_service_needed: 'Gate Service Needed',
  door_service_needed: 'Door / Access Service Needed',
};

export async function POST(request: Request) {
  const {
    siteName,
    actionTaken,
    notes,
    operatorName,
    siteContactEmail,  // primary site contact (may be null)
    alarmId,
  }: {
    siteName:         string;
    actionTaken:      string;
    notes:            string;
    operatorName:     string;
    siteContactEmail: string | null;
    alarmId:          string;
  } = await request.json();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Graceful no-op: feature works even without Resend configured
    console.warn('[service-notification] RESEND_API_KEY not set — skipping email');
    return NextResponse.json({ sent: false, reason: 'no_api_key' });
  }

  const resend  = new Resend(apiKey);
  const label   = SERVICE_LABELS[actionTaken] ?? 'Service Needed';
  const subject = `[GateGuard] ${label} — ${siteName}`;
  const ts      = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

  const body = `
<div style="font-family: sans-serif; color: #1a1a2e; max-width: 600px;">
  <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <p style="margin:0; color:#f1f5f9; font-size:18px; font-weight:700;">⚠ ${label}</p>
    <p style="margin:4px 0 0; color:#94a3b8; font-size:12px;">GateGuard Security Operations Center</p>
  </div>
  <div style="background:#f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top:none; border-radius: 0 0 8px 8px;">
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <tr><td style="padding:6px 0; color:#64748b; width:140px;">Site</td><td style="padding:6px 0; font-weight:600;">${siteName}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Action Required</td><td style="padding:6px 0; font-weight:600; color:#dc2626;">${label}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Detected</td><td style="padding:6px 0;">${ts} EST</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Operator</td><td style="padding:6px 0;">${operatorName}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Alarm ID</td><td style="padding:6px 0; font-size:11px; color:#94a3b8;">${alarmId}</td></tr>
    </table>
    ${notes ? `
    <div style="margin-top:16px; padding:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px;">
      <p style="margin:0 0 4px; font-size:11px; font-weight:600; color:#991b1b; text-transform:uppercase; letter-spacing:.05em;">Operator Notes</p>
      <p style="margin:0; font-size:13px; color:#7f1d1d;">${notes}</p>
    </div>` : ''}
    <p style="margin-top:20px; font-size:12px; color:#94a3b8;">
      Please schedule service and acknowledge this notification. This is an automated alert from GateGuard SOC.
    </p>
  </div>
</div>
`.trim();

  const recipients = [OPS_EMAIL];
  if (siteContactEmail && siteContactEmail !== OPS_EMAIL) {
    recipients.push(siteContactEmail);
  }

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      recipients,
      subject,
      html:    body,
    });

    if (error) {
      console.error('[service-notification] Resend error:', error);
      return NextResponse.json({ sent: false, error: error.message }, { status: 500 });
    }

    console.log(`[service-notification] ✓ Sent to ${recipients.join(', ')} | id=${data?.id}`);
    return NextResponse.json({ sent: true, recipients, id: data?.id });
  } catch (err: any) {
    console.error('[service-notification] Unexpected error:', err);
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 });
  }
}
