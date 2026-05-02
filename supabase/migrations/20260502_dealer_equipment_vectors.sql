-- ─────────────────────────────────────────────────────────────────────────────
-- GateGuard Dealer Portal — Equipment Library + Vector Knowledge Base
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Requires: pgvector extension (enable in Dashboard → Database → Extensions)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgvector
create extension if not exists vector;

-- ── equipment ─────────────────────────────────────────────────────────────────
-- Master device catalog. One row per model.
create table if not exists equipment (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in (
                    'gate_operator', 'callbox', 'access_reader',
                    'smart_lock', 'camera', 'network', 'intercom', 'other'
                  )),
  brand           text not null,
  model           text not null,
  model_number    text,
  description     text,
  -- Manual stored in Supabase Storage bucket "manuals"
  manual_path     text,                        -- storage path, e.g. "liftmaster/la400-manual.pdf"
  manual_url      text,                        -- public URL (set after upload)
  spec_sheet_url  text,
  product_url     text,
  image_url       text,
  -- Metadata
  install_time_hrs numeric(4,1),               -- typical install time in hours
  tags            text[],                      -- e.g. {gate, slide, residential}
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (brand, model)
);

create index if not exists equipment_category_idx on equipment(category);
create index if not exists equipment_brand_idx    on equipment(brand);

-- ── manual_chunks ─────────────────────────────────────────────────────────────
-- Each row is one chunked passage from a PDF manual, with its vector embedding.
-- Semantic search queries this table via cosine similarity.
create table if not exists manual_chunks (
  id              uuid primary key default gen_random_uuid(),
  equipment_id    uuid not null references equipment(id) on delete cascade,
  -- Source location
  manual_url      text,
  page_number     int,
  section_title   text,                        -- extracted heading if available
  chunk_index     int not null,                -- position within document
  -- Content
  content         text not null,               -- raw text of this chunk (~400 tokens)
  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dims)
  embedding       vector(1536),
  -- Processing metadata
  token_count     int,
  processed_at    timestamptz not null default now()
);

create index if not exists manual_chunks_equipment_idx on manual_chunks(equipment_id);

-- IVFFlat index for fast approximate nearest-neighbour search
-- (rebuild after bulk inserts with: REINDEX INDEX manual_chunks_embedding_idx)
create index if not exists manual_chunks_embedding_idx
  on manual_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── troubleshoot_sessions ──────────────────────────────────────────────────────
-- Logs each dealer troubleshooting session for analytics + continuous improvement
create table if not exists troubleshoot_sessions (
  id              uuid primary key default gen_random_uuid(),
  equipment_id    uuid references equipment(id) on delete set null,
  user_id         text,                        -- Clerk user ID
  symptom         text not null,               -- initial problem description
  steps_taken     jsonb,                       -- array of {question, answer, step_index}
  resolved        boolean,
  resolution_note text,
  chunks_used     uuid[],                      -- which manual_chunks were referenced
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists troubleshoot_sessions_equipment_idx on troubleshoot_sessions(equipment_id);
create index if not exists troubleshoot_sessions_created_idx   on troubleshoot_sessions(created_at desc);

-- ── RPC: match_manual_chunks ──────────────────────────────────────────────────
-- Semantic similarity search used by the troubleshooting API.
-- Returns top-k chunks most similar to the query embedding.
--
-- Usage (from the API):
--   select * from match_manual_chunks(
--     query_embedding  := '[0.1, 0.2, ...]'::vector,
--     match_threshold  := 0.5,
--     match_count      := 8,
--     filter_equipment := null          -- pass uuid to restrict to one device
--   );
create or replace function match_manual_chunks(
  query_embedding   vector(1536),
  match_threshold   float    default 0.45,
  match_count       int      default 8,
  filter_equipment  uuid     default null
)
returns table (
  id              uuid,
  equipment_id    uuid,
  brand           text,
  model           text,
  category        text,
  manual_url      text,
  page_number     int,
  section_title   text,
  content         text,
  similarity      float
)
language sql stable
as $$
  select
    mc.id,
    mc.equipment_id,
    e.brand,
    e.model,
    e.category,
    mc.manual_url,
    mc.page_number,
    mc.section_title,
    mc.content,
    1 - (mc.embedding <=> query_embedding) as similarity
  from manual_chunks mc
  join equipment e on e.id = mc.equipment_id
  where
    mc.embedding is not null
    and (filter_equipment is null or mc.equipment_id = filter_equipment)
    and 1 - (mc.embedding <=> query_embedding) > match_threshold
  order by mc.embedding <=> query_embedding
  limit match_count;
$$;

-- ── auto-update updated_at ────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists equipment_updated_at on equipment;
create trigger equipment_updated_at
  before update on equipment
  for each row execute function set_updated_at();

drop trigger if exists troubleshoot_sessions_updated_at on troubleshoot_sessions;
create trigger troubleshoot_sessions_updated_at
  before update on troubleshoot_sessions
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table equipment            enable row level security;
alter table manual_chunks        enable row level security;
alter table troubleshoot_sessions enable row level security;

-- Equipment + chunks: all authenticated users can read
create policy "Authenticated read equipment"
  on equipment for select to authenticated using (true);

create policy "Authenticated read manual_chunks"
  on manual_chunks for select to authenticated using (true);

-- Troubleshoot sessions: users see their own; service role sees all
create policy "Users manage own sessions"
  on troubleshoot_sessions for all to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- ── Seed: core equipment catalog ──────────────────────────────────────────────
-- Standard GateGuard install stack — manuals to be uploaded separately
insert into equipment (category, brand, model, model_number, description, tags, install_time_hrs) values
  -- Gate Operators
  ('gate_operator', 'LiftMaster', 'LA400',     'LA400PKGU',  'Swing gate operator, residential/light commercial, 12V DC battery backup', array['swing','gate','residential','battery-backup'], 4.0),
  ('gate_operator', 'LiftMaster', 'CSW200',    'CSW200UL',   'Commercial slide gate operator, 1/2 HP, UL 325 listed', array['slide','gate','commercial'], 6.0),
  ('gate_operator', 'FAAC',       '740',       '109778',     'Heavy duty swing gate operator, up to 1800 lbs', array['swing','gate','heavy-duty'], 5.0),
  ('gate_operator', 'FAAC',       '844 ER',    '109881',     'Slide gate operator, rack driven, up to 880 lbs', array['slide','gate','residential'], 4.5),
  ('gate_operator', 'BFT',        'Phobos AC', 'P111120',    'Swing gate operator, 230V AC, up to 400kg per leaf', array['swing','gate','ac-powered'], 4.0),
  ('gate_operator', 'Elite',      'EL2000',    'EL2000',     'Commercial swing gate operator, solar compatible', array['swing','gate','solar'], 5.0),
  -- Callboxes
  ('callbox',       '2N',         'IP Verso',  '9155301',    'IP video intercom, 1-button, HD camera, touchscreen', array['callbox','video','ip','multifamily'], 2.0),
  ('callbox',       '2N',         'IP Force',  '9151101',    'IP audio/video intercom, ruggedized, vandal-resistant', array['callbox','video','ip','ruggedized'], 2.0),
  ('callbox',       'DoorBird',   'D21DKH',    'D21DKH',     'Video door station, PoE, HD camera, night vision', array['callbox','video','poe','residential'], 1.5),
  ('callbox',       'Viking',     'E-50-IP',   'E-50-IP',    'IP entry phone, stainless, ADA compliant', array['callbox','audio','ip','ada'], 1.5),
  ('callbox',       'Aiphone',    'IX-DV',     'IX-DV',      'IP video door station, SIP, wide-angle camera', array['callbox','video','sip','ip'], 2.0),
  -- Access Readers
  ('access_reader', 'Ubiquiti',   'UA-Reader Pro', 'UA-READER-PRO', 'UniFi Access reader, NFC/BLE/PIN, PoE, touchscreen', array['access','nfc','ble','poe','unifi'], 1.0),
  ('access_reader', 'Ubiquiti',   'UA-Hub',    'UA-HUB',     'UniFi Access hub, manages up to 4 doors', array['access','hub','unifi','controller'], 1.5),
  ('access_reader', 'Brivo',      'ACS300',    'ACS300',     'Cloud-based access control panel, 2-door, 12V', array['access','cloud','brivo','panel'], 2.0),
  ('access_reader', 'HID',        'iCLASS SE', 'R10',        'Contactless smart card reader, 13.56MHz', array['access','smartcard','hid'], 0.5),
  -- Smart Locks
  ('smart_lock',    'Schlage',    'BE489WB',   'BE489WB CAM 619', 'WiFi deadbolt, Z-Wave Plus, keypad + lever, satin nickel', array['lock','wifi','zwave','deadbolt'], 0.5),
  ('smart_lock',    'Yale',       'YRD256',    'YRD256-NR',  'Assure lock 2, Z-Wave, touchscreen, no key', array['lock','zwave','touchscreen'], 0.5),
  ('smart_lock',    'Allegion',   'XE360',     'XE360-C-626','Cylindrical lever, credential-flexible, offline capable', array['lock','cylindrical','offline','credential-flex'], 1.0),
  -- Cameras
  ('camera',        'Ubiquiti',   'G4 Pro',    'UVC-G4-PRO', '4K PoE camera, 3-lens, IR night vision, AI detection', array['camera','4k','poe','ai','unifi'], 1.0),
  ('camera',        'Ubiquiti',   'G4 Bullet',  'UVC-G4-BULLET', '4MP PoE bullet, IR, weatherproof, UniFi Protect', array['camera','4mp','poe','bullet','unifi'], 0.75),
  ('camera',        'Axis',       'P3245-V',   'P3245-V',    '2MP fixed dome, WDR, HDTV 1080p, ARTPEC-6', array['camera','dome','wdr','axis'], 1.0),
  -- Network
  ('network',       'Ubiquiti',   'USW-24',    'USW-24',     'UniFi Switch 24, managed, Gigabit, 52W PoE', array['switch','poe','managed','unifi'], 1.0),
  ('network',       'Ubiquiti',   'U6-Pro',    'U6-PRO',     'UniFi AP WiFi 6, 4x4 MU-MIMO, PoE, indoor', array['ap','wifi6','poe','unifi'], 0.75),
  ('network',       'Ubiquiti',   'UDR',       'UDR',        'UniFi Dream Router, all-in-one, WiFi 6, IDS/IPS', array['router','wifi6','all-in-one','unifi'], 1.5)
on conflict (brand, model) do nothing;
