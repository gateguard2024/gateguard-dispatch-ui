-- Migration: Vision-based gate monitoring tables
-- Supports multi-gate cameras (e.g. Exit / Resident / Guest in one frame)
-- State machine: closed → open_active → open_idle → stuck_open → closed
--
-- Run on beta first, then main.

-- ── 1. Gate configuration per camera ─────────────────────────────────────────
-- One row per gate lane within a camera frame.
-- A camera showing 3 gates has 3 rows here.

CREATE TABLE IF NOT EXISTS gate_camera_configs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id              uuid NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  gate_index             int  NOT NULL DEFAULT 0,              -- 0=first, 1=second, 2=third
  gate_label             text NOT NULL DEFAULT 'Main Gate',    -- e.g. "Exit", "Resident", "Guest"
  idle_threshold_seconds int  NOT NULL DEFAULT 300,            -- alert after this many seconds idle-open
  enabled                boolean NOT NULL DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  UNIQUE(camera_id, gate_index)
);

COMMENT ON TABLE  gate_camera_configs IS 'Per-gate configuration for Vision AI monitoring. One row per gate lane visible in the camera frame.';
COMMENT ON COLUMN gate_camera_configs.idle_threshold_seconds IS 'Seconds gate must be open with no traffic before firing gate_stuck_open alarm. Default 300s (5 min).';

-- ── 2. Live gate state per camera/gate ───────────────────────────────────────
-- Updated by the cron every minute while monitoring_until > now().
-- monitoring_until is set by the EEN motion webhook when a gate camera triggers.

CREATE TABLE IF NOT EXISTS gate_monitor_states (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id         uuid NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  gate_label        text NOT NULL,
  status            text NOT NULL DEFAULT 'closed',   -- closed | open_active | open_idle | stuck_open
  idle_since        timestamptz,                       -- when idle state began (null if active/closed)
  stuck_alarm_id    uuid,                              -- FK to alarms.id for the stuck_open alarm
  last_checked_at   timestamptz DEFAULT now(),
  monitoring_until  timestamptz,                       -- cron ignores this row after this timestamp
  UNIQUE(camera_id, gate_label)
);

COMMENT ON TABLE  gate_monitor_states IS 'Live state machine state per gate. Rows with monitoring_until > now() are polled by the Vision cron every minute.';
COMMENT ON COLUMN gate_monitor_states.idle_since IS 'Timestamp when gate first became idle-open (no traffic flowing). Null when gate is active or closed.';
COMMENT ON COLUMN gate_monitor_states.monitoring_until IS 'Cron only processes rows where this is in the future. Set by motion webhook; extended when stuck.';

-- Index for fast cron query (only active monitoring windows)
CREATE INDEX IF NOT EXISTS idx_gate_monitor_active
  ON gate_monitor_states (monitoring_until)
  WHERE monitoring_until IS NOT NULL;

-- ── 3. site_events table (portal-shared) ─────────────────────────────────────
-- Only creates if not already present. The portal may own this table.
-- gate_stuck_open and gate_restored events are written here so the
-- portal.gateguard.co property manager dashboard can display them.

CREATE TABLE IF NOT EXISTS site_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     uuid REFERENCES zones(id) ON DELETE CASCADE,
  event_type  text NOT NULL,                                -- gate_stuck_open | gate_restored | ...
  title       text NOT NULL,
  description text,
  severity    text NOT NULL DEFAULT 'info',                 -- info | warning | critical
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_events_zone_created
  ON site_events (zone_id, created_at DESC);
