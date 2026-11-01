-- =============================================================================
-- Bake n Take — Phase 3: product catalog foundation
-- =============================================================================
-- Normalized catalog model:
--
--   product_types (lookup, seeded)
--     ↓
--   categories  →  products  →  product_images
--                               product_variants
--                               product_flavours
--
-- Design decisions:
--   * Money is integer paise everywhere (no floats, no precision loss).
--   * Slugs are the public URL identity (/shop/[slug]); internal UUIDs never
--     appear in customer URLs. Product slugs stay unique forever so renames
--     cannot break old links (rename = new row? no — slug is stable once set;
--     the app generates it once at creation and keeps it).
--   * Availability is two flags: archived_at (soft delete, hidden from the
--     catalog) and is_active (unavailable but visible, clearly marked).
--     Nothing is hard-deleted while dependents exist: products.category_id is
--     ON DELETE RESTRICT, children are ON DELETE CASCADE (a deleted product
--     takes its own options; future orders will reference snapshots, not rows).
--   * Product images live in the existing public `store-assets` bucket
--     (products/…); customer design drafts live in the private
--     `customer-designs` bucket (tmp/<uid>/…) readable only by owners.
--   * Public RLS exposes only non-archived catalog data (plus active
--     categories); owners see everything. Writes are owner-only.
--
-- The script is idempotent so it can be re-run safely from the SQL editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Product types (lookup — new types need rows, not redesigns)
-- ---------------------------------------------------------------------------

create table if not exists public.product_types (
  id smallint generated always as identity primary key,
  name text not null unique
    constraint product_types_name_length check (char_length(name) between 1 and 40),
  slug text not null unique
    constraint product_types_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

insert into public.product_types (name, slug) values
  ('Cake', 'cake'),
  ('Cupcake', 'cupcake'),
  ('Brownie', 'brownie'),
  ('Cookie', 'cookie'),
  ('Pastry', 'pastry'),
  ('Other', 'other')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Categories
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint categories_name_length check (char_length(name) between 1 and 80),
  slug text not null
    constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default ''
    constraint categories_description_length check (char_length(description) <= 500),
  image_path text
    constraint categories_image_length check (image_path is null or char_length(image_path) <= 500),
  display_order integer not null default 0
    constraint categories_order_range check (display_order between 0 and 1000000),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No duplicate slugs among live categories; archived rows keep history.
create unique index if not exists categories_slug_live_key
  on public.categories (slug)
  where archived_at is null;

create index if not exists categories_browse_idx
  on public.categories (archived_at, is_active, display_order);

-- ---------------------------------------------------------------------------
-- 3. Products
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null
    constraint products_name_length check (char_length(name) between 1 and 120),
  short_description text not null default ''
    constraint products_short_description_length check (char_length(short_description) <= 200),
  description text not null default ''
    constraint products_description_length check (char_length(description) <= 2000),
  base_price_paise integer not null default 0
    constraint products_base_price_range check (base_price_paise between 0 and 100000000),
  category_id uuid not null references public.categories (id) on delete restrict,
  product_type_id smallint not null references public.product_types (id) on delete restrict,
  variant_mode text not null default 'none'
    constraint products_variant_mode check (variant_mode in ('none', 'size', 'quantity')),
  is_active boolean not null default true,
  archived_at timestamptz,
  is_featured boolean not null default false,
  is_trending boolean not null default false,
  allow_custom_design boolean not null default false,
  egg_eggless_enabled boolean not null default false,
  eggless_surcharge_paise integer not null default 0
    constraint products_eggless_surcharge_range check (eggless_surcharge_paise between 0 and 100000000),
  message_enabled boolean not null default false,
  display_order integer not null default 0
    constraint products_order_range check (display_order between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_browse_idx
  on public.products (category_id, archived_at, is_active, display_order, created_at desc);

create index if not exists products_merchandising_idx
  on public.products (archived_at, is_active, is_featured, is_trending, display_order);

create index if not exists products_type_idx
  on public.products (product_type_id, archived_at);

-- ---------------------------------------------------------------------------
-- 4. Product children (owned rows: product delete cascades)
-- ---------------------------------------------------------------------------

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null
    constraint product_images_path_length check (char_length(storage_path) between 1 and 500),
  alt_text text not null default ''
    constraint product_images_alt_length check (char_length(alt_text) <= 160),
  display_order integer not null default 0
    constraint product_images_order_range check (display_order between 0 and 1000000),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Exactly one primary image per product.
create unique index if not exists product_images_primary_key
  on public.product_images (product_id)
  where is_primary;

create index if not exists product_images_product_idx
  on public.product_images (product_id, display_order);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null
    constraint product_variants_label_length check (char_length(label) between 1 and 60),
  value text
    constraint product_variants_value_length check (value is null or char_length(value) <= 60),
  price_paise integer not null
    constraint product_variants_price_range check (price_paise between 1 and 100000000),
  is_active boolean not null default true,
  display_order integer not null default 0
    constraint product_variants_order_range check (display_order between 0 and 1000000),
  created_at timestamptz not null default now(),
  constraint product_variants_label_unique unique (product_id, label)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, display_order)
  where is_active;

create table if not exists public.product_flavours (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null
    constraint product_flavours_name_length check (char_length(name) between 1 and 60),
  surcharge_paise integer not null default 0
    constraint product_flavours_surcharge_range check (surcharge_paise between 0 and 100000000),
  is_active boolean not null default true,
  display_order integer not null default 0
    constraint product_flavours_order_range check (display_order between 0 and 1000000),
  created_at timestamptz not null default now(),
  constraint product_flavours_name_unique unique (product_id, name)
);

create index if not exists product_flavours_product_idx
  on public.product_flavours (product_id, display_order)
  where is_active;

-- ---------------------------------------------------------------------------
-- 5. Timestamps
-- ---------------------------------------------------------------------------

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------------

alter table public.product_types enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_flavours enable row level security;

-- -- product_types: public reference data, owner-managed.
drop policy if exists product_types_select_public on public.product_types;
create policy product_types_select_public
  on public.product_types for select to anon, authenticated using (true);

drop policy if exists product_types_write_owner on public.product_types;
create policy product_types_write_owner
  on public.product_types for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- -- categories: the public sees live, active categories; owners see all.
drop policy if exists categories_select_public on public.categories;
create policy categories_select_public
  on public.categories for select to anon, authenticated
  using (archived_at is null and is_active);

drop policy if exists categories_select_owner on public.categories;
create policy categories_select_owner
  on public.categories for select to authenticated
  using (public.is_owner());

drop policy if exists categories_write_owner on public.categories;
create policy categories_write_owner
  on public.categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- -- products: the public sees non-archived rows (unavailable ones are marked
-- by the app); owners see everything including archived.
drop policy if exists products_select_public on public.products;
create policy products_select_public
  on public.products for select to anon, authenticated
  using (archived_at is null);

drop policy if exists products_select_owner on public.products;
create policy products_select_owner
  on public.products for select to authenticated
  using (public.is_owner());

drop policy if exists products_write_owner on public.products;
create policy products_write_owner
  on public.products for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- -- children: public visibility follows the parent product; writes are owner-only.
drop policy if exists product_images_select_public on public.product_images;
create policy product_images_select_public
  on public.product_images for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.archived_at is null
  ));

drop policy if exists product_images_owner on public.product_images;
create policy product_images_owner
  on public.product_images for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists product_variants_select_public on public.product_variants;
create policy product_variants_select_public
  on public.product_variants for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and p.archived_at is null
  ));

drop policy if exists product_variants_owner on public.product_variants;
create policy product_variants_owner
  on public.product_variants for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists product_flavours_select_public on public.product_flavours;
create policy product_flavours_select_public
  on public.product_flavours for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_flavours.product_id and p.archived_at is null
  ));

drop policy if exists product_flavours_owner on public.product_flavours;
create policy product_flavours_owner
  on public.product_flavours for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- 7. Privileges (RLS decides rows; privileges decide columns)
-- ---------------------------------------------------------------------------

revoke all on table public.product_types from anon, authenticated;
grant select on table public.product_types to anon, authenticated;
grant insert, update, delete on table public.product_types to authenticated;

revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;

revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

revoke all on table public.product_images from anon, authenticated;
grant select on table public.product_images to anon, authenticated;
grant insert, update, delete on table public.product_images to authenticated;

revoke all on table public.product_variants from anon, authenticated;
grant select on table public.product_variants to anon, authenticated;
grant insert, update, delete on table public.product_variants to authenticated;

revoke all on table public.product_flavours from anon, authenticated;
grant select on table public.product_flavours to anon, authenticated;
grant insert, update, delete on table public.product_flavours to authenticated;

grant all on table public.product_types to service_role;
grant all on table public.categories to service_role;
grant all on table public.products to service_role;
grant all on table public.product_images to service_role;
grant all on table public.product_variants to service_role;
grant all on table public.product_flavours to service_role;

-- ---------------------------------------------------------------------------
-- 8. Customer design drafts (private bucket; owners read, customers stage)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('customer-designs', 'customer-designs', false)
on conflict (id) do nothing;

-- Owners read every draft (future fulfillment); nobody else reads.
drop policy if exists "customer-designs owner read" on storage.objects;
create policy "customer-designs owner read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'customer-designs' and public.is_owner());

-- Authenticated customers may stage their own draft under their own folder.
-- The server action validates the file before it ever reaches storage, and
-- verifies the uid prefix on delete.
drop policy if exists "customer-designs own insert" on storage.objects;
create policy "customer-designs own insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'customer-designs'
    and name like 'tmp/' || (select auth.uid())::text || '/%'
  );

drop policy if exists "customer-designs own delete" on storage.objects;
create policy "customer-designs own delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'customer-designs'
    and name like 'tmp/' || (select auth.uid())::text || '/%'
  );

-- ---------------------------------------------------------------------------
-- 9. Post-migration verification (run manually)
-- ---------------------------------------------------------------------------
-- select tablename from pg_tables where schemaname = 'public'
--   and tablename like 'product%' or tablename = 'categories';
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename in ('products','categories');
-- select id, public from storage.buckets where id in ('store-assets','customer-designs');
