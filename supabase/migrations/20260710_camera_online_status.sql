-- Migration: add is_online to cameras table
-- is_online reflects the live connectivity status from EEN (true=online, false=offline, null=unknown/not yet synced)
-- is_monitored remains the SOC "we watch this camera" toggle — separate concern

ALTER TABLE cameras
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN cameras.is_online IS 'Live EEN connectivity status: true=online, false=offline, null=not yet synced. Updated on every hardware sync.';
COMMENT ON COLUMN cameras.last_seen_at IS 'Timestamp of last EEN sync where this camera reported online status.';
