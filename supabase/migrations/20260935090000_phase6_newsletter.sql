-- Bake n Take — Phase 6: newsletter subscriptions (customer webstore).
--
-- A minimal mailing list for the homepage "Join our family" section.
-- Customers are always signed in on the storefront, so subscriptions are
-- attributed to the caller's profile; the address is stored lowercase so
-- duplicates collapse. No secrets live here — owners can read the list.

create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null
    constraint newsletter_email_length check (
      char_length(email) >= 3 and char_length(email) <= 254
    ),
  customer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One subscription per address, case-insensitive.
create unique index if not exists newsletter_subscriptions_email_uniq
  on public.newsletter_subscriptions (lower(email));

create index if not exists newsletter_subscriptions_created_idx
  on public.newsletter_subscriptions (created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security (default deny; writes scoped to the signed-in caller)
-- ---------------------------------------------------------------------------

alter table public.newsletter_subscriptions enable row level security;

-- Signed-in customers may subscribe (attributed to themselves) ...
drop policy if exists newsletter_insert_own on public.newsletter_subscriptions;
create policy newsletter_insert_own
  on public.newsletter_subscriptions for insert to authenticated
  with check (customer_id = (select auth.uid()));

-- ... read their own subscription, while owners read the whole list.
drop policy if exists newsletter_select_scoped on public.newsletter_subscriptions;
create policy newsletter_select_scoped
  on public.newsletter_subscriptions for select to authenticated
  using (customer_id = (select auth.uid()) or public.is_owner());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.newsletter_subscriptions from anon, authenticated;

grant select, insert on table public.newsletter_subscriptions to authenticated;

grant all on table public.newsletter_subscriptions to service_role;
