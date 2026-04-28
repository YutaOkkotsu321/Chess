-- ChessTech initial schema.
-- Run this in the Supabase SQL editor (or via `supabase db push`) to create
-- the `profiles` and `games` tables, RLS policies, and a trigger that
-- auto-creates a `profiles` row whenever a new auth user signs up.

-- ============================================================================
-- profiles: extends auth.users with public-facing user data + Pro flag
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  is_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- games: completed game records (PGN + outcome)
-- ============================================================================
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pgn text not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  player_color text not null check (player_color in ('white', 'black')),
  difficulty integer not null check (difficulty between 1 and 20),
  outcome_reason text,
  total_moves integer not null default 0,
  played_at timestamptz not null default now()
);

create index if not exists games_user_played_at_idx
  on public.games (user_id, played_at desc);

-- ============================================================================
-- RLS — every user sees only their own rows
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.games enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

drop policy if exists games_self_select on public.games;
create policy games_self_select on public.games
  for select using (auth.uid() = user_id);

drop policy if exists games_self_insert on public.games;
create policy games_self_insert on public.games
  for insert with check (auth.uid() = user_id);

-- ============================================================================
-- Auto-create profile row when a user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
