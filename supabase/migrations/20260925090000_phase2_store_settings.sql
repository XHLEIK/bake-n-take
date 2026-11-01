-- =============================================================================
-- Bake n Take — Phase 2: centralized store settings + logo storage
-- =============================================================================
-- Singleton `public.store_settings` is the single source of truth for the
-- bakery's public business identity. Exactly one row may exist (id = 1).
--
-- Design decisions:
--   * One bakery today: a singleton row, not a multi-tenant system. Future
--     phases must not add a second settings mechanism.
--   * The table holds PUBLIC business information only. Never add secrets,
--     keys, or internal configuration here — RLS exposes every column to
--     anonymous visitors by design.
--   * `socials` and `hours` are jsonb so platforms and schedules can grow
--     (extra networks, split days, holidays) without schema changes. Shapes
--     are documented in lib/store/types.ts and enforced by zod server-side;
--     the database keeps structural guards (lengths, ranges, formats).
--   * Logo bytes live in Supabase Storage (`store-assets` bucket), never in
--     PostgreSQL. The table stores the storage path only.
--   * Owners write; the world reads. Updates require an ACTIVE OWNER profile
--     via the shared public.is_owner() rule, enforced twice (RLS + grants).
--
-- The script is idempotent so it can be re-run safely from the SQL editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Store settings table
-- ---------------------------------------------------------------------------

create table if not exists public.store_settings (
  id smallint primary key default 1
    constraint store_settings_singleton check (id = 1),

  -- Identity
  store_name text not null default 'Bake n Take'
    constraint store_settings_name_length check (char_length(store_name) between 1 and 80),
  short_name text not null default 'BnT'
    constraint store_settings_short_name_length check (char_length(short_name) between 1 and 20),
  tagline text not null default ''
    constraint store_settings_tagline_length check (char_length(tagline) <= 160),
  description text not null default ''
    constraint store_settings_description_length check (char_length(description) <= 1000),
  logo_path text
    constraint store_settings_logo_length check (logo_path is null or char_length(logo_path) <= 500),
  favicon_path text
    constraint store_settings_favicon_length check (favicon_path is null or char_length(favicon_path) <= 500),

  -- Contact
  phone_primary text
    constraint store_settings_phone_primary_length check (phone_primary is null or char_length(phone_primary) <= 20),
  phone_secondary text
    constraint store_settings_phone_secondary_length check (phone_secondary is null or char_length(phone_secondary) <= 20),
  email text
    constraint store_settings_email_length check (email is null or char_length(email) <= 254),
  whatsapp text
    constraint store_settings_whatsapp_length check (whatsapp is null or char_length(whatsapp) <= 20),

  -- Structured address (displayed formatted; never one free-text blob)
  address_line1 text
    constraint store_settings_address_line1_length check (address_line1 is null or char_length(address_line1) <= 120),
  address_line2 text
    constraint store_settings_address_line2_length check (address_line2 is null or char_length(address_line2) <= 120),
  locality text
    constraint store_settings_locality_length check (locality is null or char_length(locality) <= 80),
  city text
    constraint store_settings_city_length check (city is null or char_length(city) <= 80),
  state text
    constraint store_settings_state_length check (state is null or char_length(state) <= 80),
  postal_code text
    constraint store_settings_postal_length check (postal_code is null or char_length(postal_code) <= 12),
  country text not null default 'India'
    constraint store_settings_country_length check (char_length(country) between 1 and 60),
  maps_url text
    constraint store_settings_maps_url_length check (maps_url is null or char_length(maps_url) <= 500),
  latitude double precision
    constraint store_settings_lat_range check (latitude is null or (latitude >= -90 and latitude <= 90)),
  longitude double precision
    constraint store_settings_lng_range check (longitude is null or (longitude >= -180 and longitude <= 180)),

  -- Extensible maps: {"instagram": "https://…", …} and
  -- {"monday": {"open": true, "opens_at": "09:00", "closes_at": "21:00"}, …}
  socials jsonb not null default '{}',
  hours jsonb not null default '{}',

  -- Pickup (separate from the postal address on purpose)
  pickup_instructions text
    constraint store_settings_pickup_instructions_length check (pickup_instructions is null or char_length(pickup_instructions) <= 500),
  pickup_location text
    constraint store_settings_pickup_location_length check (pickup_location is null or char_length(pickup_location) <= 200),
  pickup_notes text
    constraint store_settings_pickup_notes_length check (pickup_notes is null or char_length(pickup_notes) <= 500),
  pickup_eta text
    constraint store_settings_pickup_eta_length check (pickup_eta is null or char_length(pickup_eta) <= 120),

  -- Store status (backend capability for future order phases)
  is_open boolean not null default true,
  accepting_orders boolean not null default true,
  status_message text not null default ''
    constraint store_settings_status_message_length check (char_length(status_message) <= 200),

  -- Regional foundation for future commerce phases
  currency char(3) not null default 'INR'
    constraint store_settings_currency_format check (currency ~ '^[A-Z]{3}$'),
  currency_symbol text not null default '₹'
    constraint store_settings_currency_symbol_length check (char_length(currency_symbol) between 1 and 4),
  timezone text not null default 'Asia/Kolkata'
    constraint store_settings_timezone_length check (char_length(timezone) between 1 and 60),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.store_settings is
  'Singleton source of truth for the bakery public identity (Phase 2). Exactly one row (id = 1). Public columns only — never store secrets here.';

-- ---------------------------------------------------------------------------
-- 2. Timestamps
-- ---------------------------------------------------------------------------

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Seed row (the editable source of truth, not a code fallback)
-- ---------------------------------------------------------------------------

insert into public.store_settings (id)
values (1)
on conflict (id) do nothing;

-- First-run brand defaults so the storefront renders identically until the
-- owner edits them in Store Settings. Every value below is owner-editable.
update public.store_settings
   set store_name = 'Bake n Take',
       short_name = 'BnT',
       tagline = 'A neighbourhood bakery, at your fingertips.',
       description = 'Small-batch bakes from our family kitchen. Create an account to keep your details on file and be first to hear what is coming out of the oven.',
       currency = 'INR',
       currency_symbol = '₹',
       country = 'India',
       timezone = 'Asia/Kolkata',
       is_open = true,
       accepting_orders = true,
       status_message = '',
       hours = '{"monday":{"open":true,"opens_at":"09:00","closes_at":"21:00"},"tuesday":{"open":true,"opens_at":"09:00","closes_at":"21:00"},"wednesday":{"open":true,"opens_at":"09:00","closes_at":"21:00"},"thursday":{"open":true,"opens_at":"09:00","closes_at":"21:00"},"friday":{"open":true,"opens_at":"09:00","closes_at":"21:00"},"saturday":{"open":true,"opens_at":"09:00","closes_at":"21:00"},"sunday":{"open":true,"opens_at":"10:00","closes_at":"20:00"}}'
 where id = 1
   and store_name = 'Bake n Take'
   and created_at = updated_at;

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------

alter table public.store_settings enable row level security;

-- The storefront is public: anonymous and signed-in visitors read the row.
drop policy if exists store_settings_select_public on public.store_settings;
create policy store_settings_select_public
  on public.store_settings
  for select
  to anon, authenticated
  using (true);

-- Only an ACTIVE OWNER may change the bakery identity. Customers, anonymous
-- visitors and suspended accounts cannot write, whatever the client claims.
drop policy if exists store_settings_update_owner on public.store_settings;
create policy store_settings_update_owner
  on public.store_settings
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- No INSERT or DELETE policies: the singleton is seeded above and removed
-- only by operator tooling. Application code updates the single row.

-- ---------------------------------------------------------------------------
-- 5. Table privileges (RLS decides *which rows*; privileges decide *which columns*)
-- ---------------------------------------------------------------------------

revoke all on table public.store_settings from anon, authenticated;

grant select on table public.store_settings to anon, authenticated;
grant update on table public.store_settings to authenticated;
grant all on table public.store_settings to service_role;

-- ---------------------------------------------------------------------------
-- 6. Logo storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- Public read: logos/favicons are brand assets meant to be displayed.
drop policy if exists "store-assets public read" on storage.objects;
create policy "store-assets public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'store-assets');

-- Owner-only writes: only an ACTIVE OWNER may upload, replace or delete.
drop policy if exists "store-assets owner insert" on storage.objects;
create policy "store-assets owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'store-assets' and public.is_owner());

drop policy if exists "store-assets owner update" on storage.objects;
create policy "store-assets owner update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'store-assets' and public.is_owner())
  with check (bucket_id = 'store-assets' and public.is_owner());

drop policy if exists "store-assets owner delete" on storage.objects;
create policy "store-assets owner delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'store-assets' and public.is_owner());

-- ---------------------------------------------------------------------------
-- 7. Post-migration verification (run manually)
-- ---------------------------------------------------------------------------
-- select * from public.store_settings where id = 1;
-- select relrowsecurity from pg_class where oid = 'public.store_settings'::regclass;  -- expect true
-- select policyname, cmd, roles::text from pg_policies
--  where schemaname = 'public' and tablename = 'store_settings';
-- select id, public from storage.buckets where id = 'store-assets';
-- select policyname, cmd from pg_policies
--  where schemaname = 'storage' and tablename = 'objects' and policyname like 'store-assets%';
