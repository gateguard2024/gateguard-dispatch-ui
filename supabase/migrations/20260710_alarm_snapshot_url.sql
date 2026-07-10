-- Migration: add snapshot_url to alarms table
-- Stores a public Supabase Storage URL for the JPEG captured at alarm creation time.
-- Populated async by the EEN webhook handler after inserting the alarm row.
-- null = snapshot not yet captured or EEN image unavailable.

ALTER TABLE alarms
  ADD COLUMN IF NOT EXISTS snapshot_url text DEFAULT NULL;

COMMENT ON COLUMN alarms.snapshot_url IS 'Public URL of JPEG snapshot captured from EEN at alarm creation time. Stored in Supabase Storage bucket alarm-snapshots/{alarm_id}.jpg';

-- Supabase Storage bucket must exist before snapshots can be stored.
-- Create it once in the Supabase dashboard or run:
--   INSERT INTO storage.buckets (id, name, public) VALUES ('alarm-snapshots', 'alarm-snapshots', true)
--   ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('alarm-snapshots', 'alarm-snapshots', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow public reads on the bucket
INSERT INTO storage.policies (name, bucket_id, operation, definition)
  VALUES (
    'alarm-snapshots-public-read',
    'alarm-snapshots',
    'SELECT',
    'true'
  )
  ON CONFLICT DO NOTHING;
