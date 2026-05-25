// lib/portalIngest.ts
// Non-blocking helper to push alarm/patrol events to the GateGuard Portal
// incidents feed at portal.gateguard.co/incidents.
//
// Requires on GGSOC Vercel:
//   NEXT_PUBLIC_PORTAL_URL     = https://portal.gateguard.co
//   NEXT_PUBLIC_GGSOC_SECRET   = <same value as portal GGSOC_WEBHOOK_SECRET>

export type IngestPayload =
  | {
      source:          'soc_alarm'
      source_id:       string        // alarm.id
      incident_status: 'open' | 'resolved'
      site_name:       string
      een_account_id?: string
      brivo_account_id?: string
      event_type?:     string
      event_label?:    string
      priority?:       string        // P1 | P2 | P3 | P4
      operator_name?:  string
      action_taken?:   string
      notes?:          string
    }
  | {
      source:          'soc_patrol'
      source_id:       string        // patrolLogId::accountId
      incident_status: 'open' | 'resolved'
      site_name:       string
      een_account_id?: string
      issue_detail?:   string
      operator_name?:  string
      patrol_type?:    string
    }

/**
 * Fire-and-forget POST to portal /api/incidents/ingest.
 * Never throws — all errors logged to console.warn only.
 */
export function pushToPortal(payload: IngestPayload): void {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL
  const secret    = process.env.NEXT_PUBLIC_GGSOC_SECRET
  if (!portalUrl || !secret) return   // env not configured — skip silently

  fetch(`${portalUrl}/api/incidents/ingest`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-ggsoc-secret': secret,
    },
    body: JSON.stringify(payload),
  }).catch(err => console.warn('[portal-ingest] push failed:', err))
}
