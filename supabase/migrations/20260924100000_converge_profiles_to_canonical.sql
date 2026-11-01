-- =============================================================================
-- Bake n Take — converge public.profiles onto the Phase 1 canonical model
-- =============================================================================
-- The live project still carried the earlier-generation `profiles` shape
-- (surrogate uuid PK + separate auth_user_id, lowercase text role/status).
-- The Phase 1 canonical model keys the profile directly on auth.users.id and
-- uses enums. This migration converges the database WITHOUT losing accounts:
--
--   * every existing row is re-keyed to its auth user (auth_user_id),
--   * lowercase text roles/status are promoted to the canonical enums,
--   * the legacy `auth_user_id` column survives as a unique back-reference for
--     continuity with data created before this migration,
--   * triggers, policies, privileges and helper functions are rebuilt to the
--     canonical Phase 1 definitions (same contract as
--     20260924090000_phase1_auth_foundation.sql).
--
-- Safety: nothing references profiles.id via foreign keys (verified), so the
-- table can be rebuilt in place. The migration aborts instead of dropping data
-- if any existing row cannot be linked to an auth user.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Abort rather than silently drop unlinked rows
-- ---------------------------------------------------------------------------

do $$
declare
  unlinked integer;
begin
  select count(*) into unlinked from public.profiles where auth_user_id is null;
  if unlinked > 0 then
    raise exception
      'profiles contains % row(s) without auth_user_id; refusing to converge automatically',
      unlinked
      using errcode = 'P0001';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Remove previous-generation objects
-- ---------------------------------------------------------------------------

drop trigger if exists trg_touch_profiles on public.profiles;
drop policy if exists "Read all profiles (owner)" on public.profiles;
drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;

-- ---------------------------------------------------------------------------
-- 2. Enums (idempotent)
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
-- 3. Rebuild the table in the canonical shape, preserving every account
-- ---------------------------------------------------------------------------

create table public.profiles_canonical (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Legacy continuity column: profiles created before convergence key on this.
  auth_user_id uuid unique references auth.users (id) on delete cascade,
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

insert into public.profiles_canonical
  (id, auth_user_id, full_name, email, phone, role, status, created_at, updated_at)
select
  p.auth_user_id,
  p.auth_user_id,
  coalesce(p.full_name, ''),
  p.email,
  p.phone,
  case upper(p.role) when 'OWNER' then 'OWNER'::public.user_role else 'CUSTOMER'::public.user_role end,
  case upper(p.status) when 'SUSPENDED' then 'SUSPENDED'::public.account_status else 'ACTIVE'::public.account_status end,
  p.created_at,
  p.updated_at
from public.profiles p
on conflict (id) do nothing;

drop table public.profiles;
alter table public.profiles_canonical rename to profiles;

-- Unique emails, case-insensitively, ignoring rows without an email.
create unique index profiles_email_lower_key
  on public.profiles (lower(email))
  where email is not null and email <> '';

create index profiles_role_idx on public.profiles (role);

comment on table public.profiles is
  'Application-level bakery user. Authenticates through Supabase Auth (auth.users); never stores credentials.';
comment on column public.profiles.auth_user_id is
  'Legacy back-reference to auth.users. Kept for rows created before convergence; equals id.';
comment on column public.profiles.role is
  'CUSTOMER by default. Only trusted server/database logic may change it.';
comment on column public.profiles.status is
  'ACTIVE users can sign in. SUSPENDED users are rejected by RLS and by the app.';

-- ---------------------------------------------------------------------------
-- 4. Helper functions (canonical Phase 1 definitions)
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
-- Signature unchanged so the Phase 2 table policies that already reference
-- public.is_owner() keep working — they now also require ACTIVE status.
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
-- 5. Profile provisioning and email sync (auth.users triggers)
-- ---------------------------------------------------------------------------

-- Role is hard-coded to CUSTOMER: user metadata is client-editable and must
-- never influence authorization. auth_user_id mirrors id for legacy continuity.
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

  insert into public.profiles (id, auth_user_id, full_name, email, phone, role, status)
  values (new.id, new.id, safe_name, safe_email, left(meta_phone, 20), 'CUSTOMER', 'ACTIVE')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

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
-- 6. Role/status escalation guard (defence in depth)
-- ---------------------------------------------------------------------------

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
-- 7. Row level security (canonical, default-deny for anon)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_or_owner on public.profiles;
create policy profiles_select_own_or_owner
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.is_owner());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) and status = 'ACTIVE')
  with check (id = (select auth.uid()));

-- No INSERT or DELETE policies: profiles are created by the auth trigger and
-- removed by the `on delete cascade` from auth.users.

-- ---------------------------------------------------------------------------
-- 8. Privileges (rows via RLS, columns via grants)
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from anon, authenticated;

grant select (id, auth_user_id, full_name, email, phone, role, status, created_at, updated_at)
  on public.profiles to authenticated;

grant update (full_name, phone) on public.profiles to authenticated;

grant all on table public.profiles to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_profile_email() from public, anon, authenticated;
revoke all on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_owner() to service_role;

-- ---------------------------------------------------------------------------
-- 9. Backfill any auth user that somehow has no profile
-- ---------------------------------------------------------------------------

insert into public.profiles (id, auth_user_id, full_name, email, role, status)
select
  u.id,
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
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
