-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Every table carries user_id, and row-level security means each signed-in user only sees their own rows.

create extension if not exists "pgcrypto";

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  sells text,
  audience text,
  created_at timestamptz not null default now()
);

create table if not exists style_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id uuid not null references brands on delete cascade,
  version int not null,
  fields jsonb not null,
  rules jsonb not null default '[]'::jsonb,
  change_note text,
  created_at timestamptz not null default now(),
  unique (brand_id, version)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id uuid references brands on delete set null,
  title text,
  duration_s numeric,
  brief text,
  words jsonb,
  segments jsonb,
  language text,
  created_at timestamptz not null default now()
);

create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  idx int not null,
  start_s numeric not null,
  end_s numeric not null,
  title text,
  hook text,
  reason text,
  score int,
  outcome text check (outcome in ('great', 'ok', 'poor')),
  created_at timestamptz not null default now()
);

create table if not exists copy_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  clip_id uuid not null references clips on delete cascade,
  platform text not null check (platform in ('shorts', 'reels')),
  version int not null,
  content jsonb not null,
  language text,
  instruction text,
  made_rule boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists plan_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  clip_id uuid not null references clips on delete cascade,
  platform text not null check (platform in ('shorts', 'reels')),
  day date not null,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['brands','style_cards','projects','clips','copy_versions','plan_slots'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
