-- SUPABASE_MIGRATION__001f_alarms_tables.sql
-- Run in Supabase SQL Editor
-- Creates alarms, incident_reports, and procedures tables
-- Also adds account_id + alarm_id to audit_logs

-- ─── 1. alarms ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alarms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority     TEXT NOT NULL CHECK (priority IN ('P1','P2','P3','P4')),
  event_type   TEXT,
  event_label  TEXT,
  site_name    TEXT,
  camera_id    UUID REFERENCES cameras(id) ON DELETE SET NULL,
  zone_id      UUID REFERENCES zones(id)   ON DELETE SET NULL,
  account_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
  source       TEXT CHECK (source IN ('een','brivo')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','resolved')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alarms_status     ON alarms(status);
CREATE INDEX IF NOT EXISTS idx_alarms_zone_id    ON alarms(zone_id);
CREATE INDEX IF NOT EXISTS idx_alarms_priority   ON alarms(priority);
CREATE INDEX IF NOT EXISTS idx_alarms_created_at ON alarms(created_at DESC);

-- ─── 2. incident_reports ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incident_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_id       UUID REFERENCES alarms(id)   ON DELETE SET NULL,
  zone_id        UUID REFERENCES zones(id)    ON DELETE SET NULL,
  camera_id      UUID REFERENCES cameras(id)  ON DELETE SET NULL,
  operator_id    TEXT,
  operator_name  TEXT,
  action_taken   TEXT,
  notes          TEXT,
  report_type    TEXT DEFAULT 'incident',
  report_body    TEXT,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_alarm_id ON incident_reports(alarm_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_zone_id  ON incident_reports(zone_id);

-- ─── 3. procedures ───────────────────────────────────────────────────────────
-- Steps are stored as JSONB array: [{ "order": 1, "text": "..." }, ...]
-- Use event_type = 'default' for the catch-all procedure for a zone
CREATE TABLE IF NOT EXISTS procedures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     UUID REFERENCES zones(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,  -- e.g. 'motion', 'intrusion', 'default'
  title       TEXT NOT NULL DEFAULT 'Response Protocol',
  steps       JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (zone_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_procedures_zone_id ON procedures(zone_id);

-- ─── 4. Extend audit_logs ────────────────────────────────────────────────────
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alarm_id   UUID REFERENCES alarms(id)   ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_account_id ON audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_alarm_id   ON audit_logs(alarm_id);

-- ─── 5. Enable Supabase Realtime on alarms ───────────────────────────────────
-- Run this so the alarms page receives live updates without polling
ALTER PUBLICATION supabase_realtime ADD TABLE alarms;
