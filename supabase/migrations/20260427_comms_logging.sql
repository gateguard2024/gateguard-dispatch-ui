-- ──────────────────────────────────────────────────────────────────────────────
-- GateGuard Communications Logging
-- Migration: 20260427_comms_logging.sql
-- Branch:    beta
--
-- Creates three tables to audit every agent communication action:
--   calls        — Twilio call records with AI-generated post-call summary
--   emails_sent  — Every email fired (incident report, gate stuck, one-off)
--   manual_logs  — Free-text notes added from the Log tab
--
-- All tables use open RLS policies (for all using (true)) consistent with
-- the rest of the schema. Service role is used server-side for writes.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── calls ────────────────────────────────────────────────────────────────────
create table if not exists public.calls (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null    default now(),

  -- Context — at least one of these will be set
  incident_id       uuid        references public.incident_reports(id) on delete set null,
  patrol_id         uuid        references public.patrol_reports(id)   on delete set null,
  zone_id           uuid        references public.zones(id)            on delete set null,

  -- Agent who placed the call
  agent_email       text        not null,

  -- Call destination
  to_number         text        not null,
  to_name           text,
  to_role           text,   -- e.g. 'Property Manager', 'Police Department'

  -- Twilio metadata
  twilio_call_sid   text,
  duration_seconds  integer,
  outcome           text    check (outcome in ('answered', 'no-answer', 'voicemail', 'busy', 'failed', 'in-progress')),
  recording_url     text,
  transcript        text,

  -- AI-generated summary (Claude Haiku, post-call)
  ai_summary        text,

  -- Free-form outcome note from agent
  agent_note        text
);

alter table public.calls enable row level security;
create policy "calls_all" on public.calls for all using (true);

create index if not exists calls_incident_id_idx on public.calls (incident_id);
create index if not exists calls_patrol_id_idx   on public.calls (patrol_id);
create index if not exists calls_created_at_idx  on public.calls (created_at desc);

-- ── emails_sent ──────────────────────────────────────────────────────────────
create table if not exists public.emails_sent (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null    default now(),

  -- Context
  incident_id       uuid        references public.incident_reports(id) on delete set null,
  patrol_id         uuid        references public.patrol_reports(id)   on delete set null,
  zone_id           uuid        references public.zones(id)            on delete set null,

  -- Agent who sent the email
  agent_email       text        not null,

  -- Email type
  -- 'incident_report'  = P1-P4 formal report from Resolve flow
  -- 'gate_stuck_site'  = auto gate-stuck-open email to site contacts
  -- 'gate_stuck_ops'   = auto gate-stuck-open service ticket to ops@gateguard.co
  -- 'one_off'          = agent-composed message inside GG branded template
  template_type     text        not null check (template_type in (
                      'incident_report', 'gate_stuck_site', 'gate_stuck_ops', 'one_off'
                    )),

  priority          text        check (priority in ('P1', 'P2', 'P3', 'P4')),

  -- Recipients stored as JSON array: [{ name, email, role }]
  recipients        jsonb       not null default '[]',

  subject           text        not null,
  body_preview      text,   -- first 500 chars of rendered body for the log timeline

  -- Resend response
  resend_message_id text,
  status            text        not null default 'sent' check (status in ('sent', 'failed')),
  error_message     text
);

alter table public.emails_sent enable row level security;
create policy "emails_sent_all" on public.emails_sent for all using (true);

create index if not exists emails_sent_incident_id_idx on public.emails_sent (incident_id);
create index if not exists emails_sent_patrol_id_idx   on public.emails_sent (patrol_id);
create index if not exists emails_sent_created_at_idx  on public.emails_sent (created_at desc);

-- ── manual_logs ──────────────────────────────────────────────────────────────
create table if not exists public.manual_logs (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),

  -- Context
  incident_id   uuid        references public.incident_reports(id) on delete set null,
  patrol_id     uuid        references public.patrol_reports(id)   on delete set null,
  zone_id       uuid        references public.zones(id)            on delete set null,

  -- Agent who wrote the note
  agent_email   text        not null,

  body          text        not null
);

alter table public.manual_logs enable row level security;
create policy "manual_logs_all" on public.manual_logs for all using (true);

create index if not exists manual_logs_incident_id_idx on public.manual_logs (incident_id);
create index if not exists manual_logs_patrol_id_idx   on public.manual_logs (patrol_id);
create index if not exists manual_logs_created_at_idx  on public.manual_logs (created_at desc);

-- ── incident_reports — add email tracking columns if not present ──────────────
alter table public.incident_reports
  add column if not exists email_sent_at    timestamptz,
  add column if not exists email_recipients jsonb;
