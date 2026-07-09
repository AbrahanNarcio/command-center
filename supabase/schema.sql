-- IG Performance Command Center — esquema Postgres (Supabase)
-- Pegar completo en: Supabase Dashboard → SQL Editor → Run.

create table if not exists accounts (
  id text primary key,
  name text not null,
  handle text not null default '@cuenta',
  kind text not null default 'cliente' check (kind in ('propia','cliente')),
  color text not null default '#9b7cff',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists pieces (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  format text not null default 'Reel',
  status text not null default 'Idea',
  owner text not null default 'Equipo',
  day text not null default 'Lun',
  "time" text not null default '10:00',
  objective text not null default 'DM',
  hook text not null default '',
  summary text not null default '',
  cta text not null default '',
  score int not null default 70,
  created_at timestamptz not null default now()
);
create index if not exists pieces_account_idx on pieces(account_id);

create table if not exists sources (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  name text not null,
  type text not null default 'Notas',
  summary text not null default '',
  tags jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists sources_account_idx on sources(account_id);

create table if not exists metrics (
  account_id text primary key references accounts(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Tokens de Instagram cifrados (AES-256-GCM). Solo los toca el service role del servidor.
create table if not exists connections (
  account_id text primary key references accounts(id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  account_type text not null default 'BUSINESS',
  scopes jsonb not null default '[]',
  token_enc text not null,
  token_iv text not null,
  token_tag text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  status text not null default 'connected',
  error text
);

-- Perfil de cada usuario logueado: admin (equipo, edita todo) o client (ve solo su cuenta).
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'client' check (role in ('admin','client')),
  account_id text references accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- RLS activado sin políticas: la anon key no puede leer nada.
-- Todo el acceso pasa por el servidor Next con el service role.
alter table accounts enable row level security;
alter table pieces enable row level security;
alter table sources enable row level security;
alter table metrics enable row level security;
alter table connections enable row level security;
alter table profiles enable row level security;
