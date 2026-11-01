-- =============================================================================
-- Bake n Take — Phase 1: authentication foundation
-- =============================================================================
-- Creates the application profile model on top of Supabase Auth.
--
-- Design decisions:
--   * Supabase Auth (`auth.users`) remains the single source of credentials and
--     identity. No password, hash, or token is stored in the application schema.
--   * `public.profiles` is the bakery's application-level user (name, phone,
--     role, status) with a 1:1 relationship to `auth.users`.
--   * Roles/status are assigned by trusted database logic only. Customers can
--     read and edit their own name/phone and nothing else.
--   * Every rule is enforced twice: row level security for row visibility, and
--     column privileges for write scope.
--
-- The script is idempotent so it can be re-run safely from the SQL editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role' and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('CUSTOMER', 'OWNER');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'account_status' and n.nspname = 'public'
  ) then
    create type public.account_status as enum ('ACTIVE', 'PENDING', 'SUSPENDED');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Profiles table
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role public.user_role not null default 'CUSTOMER',
  status public.account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 80),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 20),
  constraint profiles_email_length check (email is null or char_length(email) <= 254)
);

comment on table public.profiles is
  'Application-level bakery user. Authenticates through Supabase Auth (auth.users); never stores credentials.';
comment on column public.profiles.role is
  'CUSTOMER by default. Only trusted server/database logic may change it.';
comment on column public.profiles.status is
  'ACTIVE users can sign in. SUSPENDED users are rejected by RLS and by the app.';

-- Unique emails, case-insensitively, ignoring rows without an email (some OAuth
-- providers may not return one).
create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email))
  where email is not null and email <> '';

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- 3. Helper functions
-- ---------------------------------------------------------------------------

-- Keeps updated_at honest on every write path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Answers "is the caller an active OWNER?" using only trusted database state.
-- SECURITY DEFINER so it can read profiles without recursion through RLS;
-- search_path is pinned to an empty string to make the function immune to
-- search_path hijacking. Exposed to `authenticated` only, so RLS policies and
-- the application can reuse the exact same rule.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'OWNER'
      and p.status = 'ACTIVE'
  );
$$;

comment on function public.is_owner() is
  'True when the authenticated caller has an ACTIVE OWNER profile. Used by RLS policies.';

-- ---------------------------------------------------------------------------
-- 4. Profile provisioning from auth.users
-- ---------------------------------------------------------------------------

-- Creates the application profile when a Supabase Auth user is created.
--
-- Only non-privileged fields are read from user metadata (`full_name`, `name`,
-- `phone`). The role is hard-coded to CUSTOMER: user metadata is
-- client-editable, so it must never be able to influence authorization.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  meta_name text := nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  meta_phone text := nullif(btrim(coalesce(meta ->> 'phone', '')), '');
  safe_email text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  safe_name text;
begin
  safe_name := left(coalesce(meta_name, split_part(coalesce(safe_email, ''), '@', 1)), 80);
  if safe_name = '' then
    safe_name := 'Friend';
  end if;

  insert into public.profiles (id, full_name, email, phone, role, status)
  values (new.id, safe_name, safe_email, left(meta_phone, 20), 'CUSTOMER', 'ACTIVE')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Keeps the profile email aligned when Supabase confirms a change of address.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = nullif(lower(btrim(coalesce(new.email, ''))), '')
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Role/status escalation guard (defence in depth)
-- ---------------------------------------------------------------------------
-- Column privileges already stop application users from writing `role` or
-- `status`. This trigger makes the rule explicit at the data level, so a future
-- policy or grant mistake cannot silently open a privilege escalation path.
-- Requests made with the service role key (operator tooling) are allowed.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  request_role text := coalesce(claims ->> 'role', 'postgres');
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and request_role in ('anon', 'authenticated') then
    raise exception
      'profiles.role and profiles.status can only be changed by trusted server-side tooling'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Default deny: with RLS enabled and no policy for a role, nothing is visible.
-- `anon` intentionally has no policy at all.
drop policy if exists profiles_select_own_or_owner on public.profiles;
create policy profiles_select_own_or_owner
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.is_owner());

-- A customer may update their own row, and only while the account is ACTIVE.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) and status = 'ACTIVE')
  with check (id = (select auth.uid()));

-- No INSERT or DELETE policies exist: profiles are created by the auth trigger
-- and removed by the `on delete cascade` from auth.users.

-- ---------------------------------------------------------------------------
-- 7. Table and column privileges
-- ---------------------------------------------------------------------------
-- RLS decides *which rows*; privileges decide *which columns*. Together they
-- mean a customer can read their own profile and edit their name and phone —
-- and cannot touch role, status, email, or anyone else's row.

revoke all on table public.profiles from anon, authenticated;

grant select (id, full_name, email, phone, role, status, created_at, updated_at)
  on public.profiles to authenticated;

grant update (full_name, phone) on public.profiles to authenticated;

-- Server-side tooling (owner bootstrap) connects with the service role.
grant all on table public.profiles to service_role;

-- Trigger functions are internal: nobody may call them through the API.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_profile_email() from public, anon, authenticated;
revoke all on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_owner() to service_role;

-- ---------------------------------------------------------------------------
-- 8. Backfill
-- ---------------------------------------------------------------------------
-- Any auth user that predates this migration gets a profile, so no account is
-- left without application data.

insert into public.profiles (id, full_name, email, role, status)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), ''),
      split_part(coalesce(lower(u.email), ''), '@', 1),
      'Friend'
    ),
    80
  ),
  nullif(lower(btrim(coalesce(u.email, ''))), ''),
  'CUSTOMER',
  'ACTIVE'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Post-migration verification (run manually)
-- ---------------------------------------------------------------------------
-- select relrowsecurity from pg_class where oid = 'public.profiles'::regclass;      -- expect true
-- select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--  where table_schema = 'public' and table_name = 'profiles'
--  order by grantee, column_name;
-- select tablename, policyname, cmd, roles::text from pg_policies
--  where schemaname = 'public' and tablename = 'profiles';


