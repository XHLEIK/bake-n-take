-- =============================================================================
-- Bake n Take — Phase 5.1: dynamic hero & store highlights engine
-- =============================================================================
-- Generic merchandising records (hero_items) referencing existing promotions,
-- products and categories — never copies. The customer carousel is assembled
-- server-side by tier (owner campaigns/offers → featured products → new
-- products → categories → announcements → default system slides → safe
-- fallback), so the homepage hero is never empty or broken.
--
-- Scheduling mirrors promotions: stored status is draft/active/paused/
-- archived, scheduled/expired are derived from the window. Expired, paused,
-- archived, deleted or unavailable sources are excluded at selection time.
-- One hero row per product (partial unique index): featuring can never
-- create duplicates.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Product merchandising flags (Phase 5.1 §5–6)
-- ---------------------------------------------------------------------------
-- is_new/new_until drive automatic "New Arrival" merchandising (no hero row
-- needed). hero_featured drives a single managed hero_items row (type =
-- 'product') synced by product save — the flag and the row never diverge
-- into duplicates.

alter table public.products
  add column if not exists is_new boolean not null default false,
  add column if not exists new_until timestamptz,
  add column if not exists hero_featured boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Carousel slide cap (Phase 5.1 §15: configurable, never flooding)
-- ---------------------------------------------------------------------------

alter table public.store_settings
  add column if not exists hero_max_slides integer not null default 5
    constraint store_settings_hero_slides_range check (hero_max_slides between 1 and 10);

-- ---------------------------------------------------------------------------
-- 3. Hero items (generic highlight records)
-- ---------------------------------------------------------------------------

create table if not exists public.hero_items (
  id uuid primary key default gen_random_uuid(),
  type text not null
    constraint hero_items_type check (type in (
      'offer', 'product', 'category', 'announcement', 'campaign', 'system'
    )),
  status text not null default 'draft'
    constraint hero_items_status check (status in ('draft', 'active', 'paused', 'archived')),
  display_order integer not null default 0
    constraint hero_items_order_range check (display_order between 0 and 10000),
  priority integer not null default 100
    constraint hero_items_priority_range check (priority between 0 and 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  title text
    constraint hero_items_title_length check (title is null or char_length(title) <= 120),
  description text
    constraint hero_items_description_length check (description is null or char_length(description) <= 500),
  cta_label text
    constraint hero_items_cta_length check (cta_label is null or char_length(cta_label) <= 40),
  image_path text
    constraint hero_items_image_length check (image_path is null or char_length(image_path) <= 500),
  dest_type text not null default 'store'
    constraint hero_items_dest_type check (dest_type in ('store', 'category', 'product')),
  dest_category_id uuid references public.categories (id) on delete set null,
  dest_product_id uuid references public.products (id) on delete set null,
  -- Source references (null for announcement/campaign/system). SET NULL so a
  -- deleted source only invalidates the slide; selection excludes it.
  -- Deliberately NO not-null constraint per type: source deletion nulls the
  -- reference (rather than blocking the delete) and the selector drops the
  -- orphaned slide. Owner actions validate references at save time.
  promotion_id uuid references public.promotions (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  is_system boolean not null default false,
  system_key text
    constraint hero_items_system_key check (
      (is_system and system_key in ('default_1', 'default_2', 'default_3'))
      or (not is_system and system_key is null)
    ),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hero_items_dates_order check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint hero_items_nonsource_refs check (
    type in ('offer', 'product', 'category')
    or (promotion_id is null and product_id is null and category_id is null)
  ),
  constraint hero_items_dest_refs check (
    (dest_type <> 'category' or dest_category_id is not null)
    and (dest_type <> 'product' or dest_product_id is not null)
  )
);

-- One hero row per product: featuring can never duplicate records.
create unique index if not exists hero_items_product_uniq
  on public.hero_items (product_id)
  where type = 'product' and not is_system;
create unique index if not exists hero_items_system_uniq
  on public.hero_items (system_key)
  where is_system;
create index if not exists hero_items_status_idx
  on public.hero_items (status, starts_at, ends_at);

drop trigger if exists hero_items_set_updated_at on public.hero_items;
create trigger hero_items_set_updated_at
  before update on public.hero_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Evergreen system slides (controlled content, not homepage hardcode)
-- ---------------------------------------------------------------------------
-- Content (headline/description/CTA/image) lives in code constants
-- (lib/hero/defaults.ts); these rows carry enable/order state only. Fixed
-- UUIDs make the seed idempotent.

insert into public.hero_items
  (id, type, status, display_order, priority, is_system, system_key)
values
  ('00000000-0000-4000-8000-000000000051', 'system', 'active', 1, 0, true, 'default_1'),
  ('00000000-0000-4000-8000-000000000052', 'system', 'active', 2, 0, true, 'default_2'),
  ('00000000-0000-4000-8000-000000000053', 'system', 'active', 3, 0, true, 'default_3')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Row level security (mirrors promotions: public sees effective-active)
-- ---------------------------------------------------------------------------

alter table public.hero_items enable row level security;

drop policy if exists hero_items_public on public.hero_items;
create policy hero_items_public
  on public.hero_items for select to anon, authenticated
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists hero_items_owner on public.hero_items;
create policy hero_items_owner
  on public.hero_items for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- 6. Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.hero_items from anon, authenticated;
grant select on table public.hero_items to anon, authenticated;
grant insert, update, delete on table public.hero_items to authenticated;
grant all on table public.hero_items to service_role;
