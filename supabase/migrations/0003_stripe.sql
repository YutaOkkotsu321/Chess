-- ChessTech 0003: Stripe subscription columns on profiles.
--
-- The webhook handler (using the service-role key) writes to these.
-- `is_pro` is the source of truth the app reads; the IDs are kept so
-- we can look the customer up in Stripe and open the billing portal.

alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_current_period_end timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);
