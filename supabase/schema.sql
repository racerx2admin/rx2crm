-- RX2 CRM: lead discovery tables. Run once in the Supabase SQL editor.

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source text not null,
  seed text,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error text,
  leads_found int not null default 0,
  leads_saved int not null default 0,
  searches int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company text not null,
  website text,
  domain text unique,
  name_key text not null unique,
  city text,
  state text,
  what_they_do text,
  category text,
  source text not null,
  seed text,
  contact_email text,
  contact_phone text,
  contact_url text,
  contact_name text,
  why_fit text,
  score int not null check (score between 1 and 5),
  source_links text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'approved', 'skipped', 'contacted')),
  notes text,
  run_id uuid references runs(id) on delete set null
);

create index if not exists leads_status_score on leads (status, score desc, created_at desc);

-- The app talks to these tables only from the server with the service role key.
-- Row level security with no policies blocks the public (anon) key entirely.
alter table runs enable row level security;
alter table leads enable row level security;
