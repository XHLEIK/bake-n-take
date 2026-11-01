-- =============================================================================
-- Bake n Take — Phase 3 revision: categories become the product type
-- =============================================================================
-- Owner direction: no separate product-type system, no category display
-- order/description/image/active toggle, no standalone categories page.
-- Categories are name-only groupings managed from the Products area, and
-- deleting a category must never delete products — they become uncategorized.
--
-- Changes:
--   * public.categories keeps id, name, slug, timestamps. Drops description,
--     image_path, display_order, is_active, archived_at. Slugs become plain
--     unique (no live/archived split anymore).
--   * public.products.category_id becomes nullable with ON DELETE SET NULL:
--     deleting a category orphans nothing; affected products simply have no
--     category until the owner reassigns them.
--   * public.products.product_type_id and public.product_types go away
--     entirely: the category is the product type.
--   * Category RLS simplifies to public-read-everything / owner-write.
--
-- Safe to re-run. Existing products keep their categories; only the live
-- project state was verified empty before writing this migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Slim categories to name-only groupings
-- ---------------------------------------------------------------------------

-- Policies first: several reference the columns being dropped.
drop policy if exists categories_select_public on public.categories;
drop policy if exists categories_select_owner on public.categories;
drop policy if exists categories_write_owner on public.categories;

alter table public.categories drop column if exists description;
alter table public.categories drop column if exists image_path;
alter table public.categories drop column if exists display_order;
alter table public.categories drop column if exists is_active;
alter table public.categories drop column if exists archived_at;

drop index if exists public.categories_slug_live_key;
drop index if exists public.categories_browse_idx;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass and conname = 'categories_slug_unique'
  ) then
    alter table public.categories add constraint categories_slug_unique unique (slug);
  end if;
end
$$;

create index if not exists categories_name_idx on public.categories (name);

-- ---------------------------------------------------------------------------
-- 2. Products: category becomes optional with SET NULL, type goes away
-- ---------------------------------------------------------------------------

-- Drop the category FK (name is system-generated — look it up first).
do $$
declare
  conname text;
begin
  select c.conname into conname
    from pg_constraint c
    join pg_class target on target.oid = c.confrelid
   where c.conrelid = 'public.products'::regclass
     and target.relname = 'categories'
   limit 1;
  if conname is not null then
    execute 'alter table public.products drop constraint ' || quote_ident(conname);
  end if;
end
$$;

alter table public.products alter column category_id drop not null;

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories (id)
  on delete set null;

-- Drop the product-type FK, column, index and lookup table.
do $$
declare
  conname text;
begin
  select c.conname into conname
    from pg_constraint c
    join pg_class target on target.oid = c.confrelid
   where c.conrelid = 'public.products'::regclass
     and target.relname = 'product_types'
   limit 1;
  if conname is not null then
    execute 'alter table public.products drop constraint ' || quote_ident(conname);
  end if;
end
$$;

drop index if exists public.products_type_idx;
alter table public.products drop column if exists product_type_id;
drop table if exists public.product_types;

-- ---------------------------------------------------------------------------
-- 3. Category RLS: everything is visible, owners manage
-- ---------------------------------------------------------------------------

drop policy if exists categories_select_public on public.categories;
create policy categories_select_public
  on public.categories
  for select
  to anon, authenticated
  using (true);

drop policy if exists categories_select_owner on public.categories;
create policy categories_select_owner
  on public.categories
  for select
  to authenticated
  using (public.is_owner());

drop policy if exists categories_write_owner on public.categories;
create policy categories_write_owner
  on public.categories
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;
grant all on table public.categories to service_role;

-- ---------------------------------------------------------------------------
-- 4. Verification (run manually)
-- ---------------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'categories' order by 1;
-- select conname, confdeltype from pg_constraint
--  where conrelid = 'public.products'::regclass and confrelid is not null;
-- select tablename from pg_tables where schemaname = 'public' and tablename = 'product_types';
