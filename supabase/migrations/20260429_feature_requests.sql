-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: feature_requests table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feature_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  description      text,
  category         text        NOT NULL DEFAULT 'general'
                               CHECK (category IN ('general','ui','comms','patrol','alarms','reporting','integration','other')),
  priority         text        NOT NULL DEFAULT 'normal'
                               CHECK (priority IN ('low','normal','high','critical')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','in_review','accepted','shipped','declined')),
  submitted_by     text        NOT NULL,
  submitted_by_id  text,
  admin_notes      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_feature_requests_status     ON public.feature_requests (status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON public.feature_requests (created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_requests_updated_at ON public.feature_requests;
CREATE TRIGGER feature_requests_updated_at
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Enable row-level security
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can INSERT their own requests
CREATE POLICY "Authenticated users can submit requests"
  ON public.feature_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Anyone authenticated can SELECT (operators see their own status)
CREATE POLICY "Authenticated users can view requests"
  ON public.feature_requests FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Service role can UPDATE (admin actions go through server-side API)
-- (service role bypasses RLS by default — no policy needed for service role)
