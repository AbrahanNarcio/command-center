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
  -- Guion + ángulo: { angle, cuerpo }. Piezas viejas: { angle, problema, solucion, pruebaSocial } (se leen fundiendo en cuerpo).
  script jsonb not null default '{}',
  -- Fecha programada (YYYY-MM-DD) para el calendario mensual. Null = solo en la semana.
  date date,
  score int not null default 70,
  created_at timestamptz not null default now()
);
create index if not exists pieces_account_idx on pieces(account_id);

-- MIGRACIÓN (bases creadas antes del guion estructurado): corre esta línea una vez.
-- alter table pieces add column if not exists script jsonb not null default '{}';
-- MIGRACIÓN (calendario mensual): corre esta línea una vez.
-- alter table pieces add column if not exists date date;

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

-- Perfil de cada usuario logueado. Roles:
--   admin  = equipo, acceso total a todas las cuentas
--   editor = mueve todo pero SOLO de su cuenta (piezas, fuentes, métricas, reportes, conectar su IG)
--   client = solo lectura de su cuenta (nombre histórico de "viewer")
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'client' check (role in ('admin','editor','client')),
  account_id text references accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- MIGRACIÓN DE ROLES (bases creadas antes del rol editor): corre este bloque una vez.
-- alter table profiles drop constraint if exists profiles_role_check;
-- alter table profiles add constraint profiles_role_check check (role in ('admin','editor','client'));

-- RLS activado sin políticas: la anon key no puede leer nada.
-- Todo el acceso pasa por el servidor Next con el service role.
alter table accounts enable row level security;
alter table pieces enable row level security;
alter table sources enable row level security;
alter table metrics enable row level security;
alter table connections enable row level security;
alter table profiles enable row level security;

-- Reportes: snapshots congelados de métricas (histórico que el sync no pisa)
create table if not exists reports (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  title text not null,
  note text not null default '',
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table reports enable row level security;

-- ─────────────────────────────────────────────────────────────
-- MENSAJES DE INSTAGRAM (bandeja + etiquetas de lead)
-- MIGRACIÓN: si tu base ya existe, corre este bloque completo una vez
-- en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────

-- Conversación de DM: una por persona (IGSID) y cuenta. Las etiquetas de lead
-- y la nota son NUESTRAS (viven aquí, no en Meta).
create table if not exists ig_conversations (
  id text primary key,                 -- conv_<igsid>_<account>
  account_id text not null references accounts(id) on delete cascade,
  igsid text not null,                 -- id del usuario de IG (Instagram-scoped ID)
  username text not null default '',   -- si la API lo da
  avatar_url text not null default '',  -- foto de perfil (URL del CDN de Meta; caduca, la refresca el sync)
  last_message_at timestamptz,
  last_snippet text not null default '',
  unread boolean not null default false,
  tags jsonb not null default '[]',    -- etiquetas de lead (propias)
  note text not null default '',
  updated_at timestamptz not null default now()
);
create unique index if not exists ig_conversations_acc_igsid on ig_conversations(account_id, igsid);

-- Mensaje individual (id = mid de Meta para dedupe entre webhook y backfill).
create table if not exists ig_messages (
  id text primary key,
  conversation_id text not null references ig_conversations(id) on delete cascade,
  account_id text not null references accounts(id) on delete cascade,
  from_me boolean not null,
  text text not null default '',
  created_at timestamptz not null
);
create index if not exists ig_messages_conv on ig_messages(conversation_id, created_at);

alter table ig_conversations enable row level security;
alter table ig_messages enable row level security;

-- MIGRACIÓN (2026-07-12, foto de perfil del contacto): si ya creaste las tablas
-- de mensajes antes de esta fecha, corre esta línea en el SQL Editor:
-- alter table ig_conversations add column if not exists avatar_url text not null default '';
