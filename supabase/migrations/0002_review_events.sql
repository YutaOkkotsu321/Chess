-- ChessTech 0002: Review usage tracking for the Free / Pro pricing tiers.
--
-- Free users can open up to 5 distinct game reviews per day; Pro users have
-- no cap (gating lives in the app layer based on profiles.is_pro).
--
-- One row per (user, game, day_key). Re-opening the same review on the same
-- day is a no-op via the primary-key conflict, so it doesn't burn quota.

create table if not exists public.review_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  day_key date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id, day_key)
);

create index if not exists review_events_user_day_idx
  on public.review_events (user_id, day_key);

alter table public.review_events enable row level security;

drop policy if exists review_events_self_select on public.review_events;
create policy review_events_self_select on public.review_events
  for select using (auth.uid() = user_id);

drop policy if exists review_events_self_insert on public.review_events;
create policy review_events_self_insert on public.review_events
  for insert with check (auth.uid() = user_id);
