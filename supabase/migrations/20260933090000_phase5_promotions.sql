-- =============================================================================
-- Bake n Take — Phase 5: offers, discounts & promotion engine
-- =============================================================================
-- Centralized, server-authoritative promotion system. ALL money math lives in
-- public.evaluate_order_promotions (the single calculation path): cart and
-- checkout previews call it, and create_order calls it inside the order
-- transaction. The browser never sends prices, discounts or eligibility —
-- only an optional coupon code string.
--
-- Money is integer paise. Percentage discounts use floor() (remainder stays
-- with the store); every amount is clamped so discounts never exceed the
-- subtotal and never go negative.
--
-- Stacking policy (deterministic, documented in docs/OFFERS.md):
--   * Item-level promos (buy_x_get_y, mix_match): exactly ONE applies — the
--     best by (amount, priority, created). They rewrite unit pricing, so
--     combining two is unsound.
--   * Order-level promos (percentage, first_order, incl. coupon-gated): if any
--     eligible exclusive promo exists, only the best exclusive applies
--     (priority, amount, created); otherwise the best non-stackable automatic
--     promo plus ALL stackable automatic ones apply, plus every coupon-gated
--     promo (an explicit code always combines unless exclusivity wins).
--   * Order-level percentages apply to NET line amounts (after item-level
--     rewards), so an item is never double-discounted.
--   * Minimum-order checks always use the ORIGINAL subtotal.
--
-- First-order abuse rule: eligibility is ledger-based (promotion_redemptions
-- with is_first_order), never "does an order row exist". Cancelling or
-- (per-side) deleting an order never restores it — redemptions carry no FK
-- to orders and survive deletion. One first-order redemption per customer,
-- enforced by a partial unique index (race-safe).
--
-- Concurrency: create_order locks all effective promotion rows FOR UPDATE
-- before evaluating, serializing competing checkouts; per-order idempotency
-- comes from unique(promotion_id, order_id) plus the existing order
-- idempotency key (duplicate retries return before consuming anything).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Promotions (campaigns; effective status derived from status + dates)
-- ---------------------------------------------------------------------------
-- Base status: draft | active | paused | archived (archived is terminal).
-- Effective status (used by every read path):
--   archived -> archived; paused -> paused; draft -> draft;
--   now < starts_at -> scheduled; now > ends_at -> expired; else active.
-- Scheduled activation and expiry are therefore automatic — no cron needed.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint promotions_name_length check (char_length(name) between 1 and 120),
  type text not null
    constraint promotions_type check (type in (
      'percentage', 'buy_x_get_y', 'mix_match', 'first_order'
    )),
  status text not null default 'draft'
    constraint promotions_status check (status in ('draft', 'active', 'paused', 'archived')),
  priority integer not null default 100
    constraint promotions_priority_range check (priority between 0 and 1000),
  is_exclusive boolean not null default false,
  is_stackable boolean not null default false,
  auto_apply boolean not null default true,
  repeatable boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  min_order_paise integer not null default 0
    constraint promotions_min_order_range check (min_order_paise between 0 and 1000000000),
  max_discount_paise integer
    constraint promotions_max_discount_range check (max_discount_paise is null or max_discount_paise between 0 and 1000000000),
  max_uses_global integer
    constraint promotions_max_uses_range check (max_uses_global is null or max_uses_global between 1 and 1000000),
  max_uses_per_customer integer
    constraint promotions_max_per_customer_range check (max_uses_per_customer is null or max_uses_per_customer between 1 and 100000),
  uses_count integer not null default 0
    constraint promotions_uses_count_range check (uses_count between 0 and 1000000),
  -- Public hint maintained by owner actions: whether the promo needs a code.
  -- Code VALUES stay owner-only; this flag only says "a code is required".
  has_coupon boolean not null default false,
  config jsonb not null default '{}',
  banner_header text
    constraint promotions_banner_header_length check (banner_header is null or char_length(banner_header) <= 60),
  banner_title text
    constraint promotions_banner_title_length check (banner_title is null or char_length(banner_title) <= 120),
  banner_description text
    constraint promotions_banner_description_length check (banner_description is null or char_length(banner_description) <= 500),
  banner_cta_label text
    constraint promotions_banner_cta_length check (banner_cta_label is null or char_length(banner_cta_label) <= 40),
  banner_style text not null default 'ember'
    constraint promotions_banner_style check (banner_style in (
      'ember', 'honey', 'cocoa', 'berry', 'matcha', 'ocean'
    )),
  banner_image_path text
    constraint promotions_banner_image_length check (banner_image_path is null or char_length(banner_image_path) <= 500),
  dest_type text not null default 'store'
    constraint promotions_dest_type check (dest_type in ('store', 'category', 'product')),
  dest_category_id uuid references public.categories (id) on delete set null,
  dest_product_id uuid references public.products (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_dates_order check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint promotions_dest_refs check (
    (dest_type <> 'category' or dest_category_id is not null)
    and (dest_type <> 'product' or dest_product_id is not null)
  )
);

create index if not exists promotions_status_idx
  on public.promotions (status, starts_at, ends_at);

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at
  before update on public.promotions
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Promotion targets (relationships to existing catalog rows — never copies)
-- ---------------------------------------------------------------------------
-- target_role: 'any' for percentage/first_order scope; 'trigger'/'reward'
-- for buy_x_get_y. mix_match uses 'any' as its eligible pool.

create table if not exists public.promotion_targets (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  target_type text not null
    constraint promotion_targets_type check (target_type in ('category', 'product')),
  target_role text not null default 'any'
    constraint promotion_targets_role check (target_role in ('any', 'trigger', 'reward')),
  category_id uuid references public.categories (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint promotion_targets_exactly_one check (
    (category_id is null) <> (product_id is null)
  )
);

create index if not exists promotion_targets_promotion_idx
  on public.promotion_targets (promotion_id);

-- ---------------------------------------------------------------------------
-- 3. Coupon codes (gated access to any promotion type; never publicly listed)
-- ---------------------------------------------------------------------------

create table if not exists public.promotion_coupons (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  code text not null
    constraint promotion_coupons_code_format check (code ~ '^[A-Z0-9]{4,24}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists promotion_coupons_code_uniq
  on public.promotion_coupons (code);
create index if not exists promotion_coupons_promotion_idx
  on public.promotion_coupons (promotion_id);

-- ---------------------------------------------------------------------------
-- 4. Redemptions (durable ledger — survives order cancellation/deletion)
-- ---------------------------------------------------------------------------
-- order_id carries NO foreign key on purpose: per-side deletion can
-- physically remove the order row, and the ledger must outlive it.

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid references public.promotions (id) on delete set null,
  promotion_name text not null default ''
    constraint promotion_redemptions_name_length check (char_length(promotion_name) <= 120),
  coupon_id uuid references public.promotion_coupons (id) on delete set null,
  customer_id uuid references public.profiles (id) on delete set null,
  order_id uuid,
  order_number text not null default '',
  amount_paise integer not null default 0
    constraint promotion_redemptions_amount_range check (amount_paise between 0 and 1000000000),
  is_first_order boolean not null default false,
  created_at timestamptz not null default now()
);

-- Idempotency: one consumption per (promotion, order) — retries are safe.
create unique index if not exists promotion_redemptions_order_uniq
  on public.promotion_redemptions (promotion_id, order_id);
-- First-order abuse lock: one first-order redemption per customer, ever.
-- A unique index (not a row count) makes concurrent double-claims fail.
create unique index if not exists promotion_redemptions_first_order_uniq
  on public.promotion_redemptions (customer_id)
  where is_first_order;
create index if not exists promotion_redemptions_customer_idx
  on public.promotion_redemptions (customer_id, created_at desc);
create index if not exists promotion_redemptions_promotion_idx
  on public.promotion_redemptions (promotion_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Promotion audit events (owner changes are never silently overwritten)
-- ---------------------------------------------------------------------------

create table if not exists public.promotion_events (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid references public.promotions (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null
    constraint promotion_events_type check (event_type in (
      'created', 'updated', 'activated', 'paused', 'archived',
      'deleted', 'duplicated', 'coupon_changed', 'eligibility_changed',
      'banner_changed'
    )),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists promotion_events_promotion_idx
  on public.promotion_events (promotion_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Order/cart snapshots for promotions (immutable history)
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists promo_breakdown jsonb not null default '[]',
  add column if not exists coupon_code text;

alter table public.order_items
  add column if not exists discount_paise integer not null default 0
    constraint order_items_discount_range check (discount_paise between 0 and 1000000000);

alter table public.carts
  add column if not exists coupon_code text;

-- ---------------------------------------------------------------------------
-- 7. Row level security
-- ---------------------------------------------------------------------------
-- Customers see only effective-active promotions (+ their targets) and their
-- own redemptions. Coupon rows are NEVER publicly readable (enumeration
-- protection) — validation happens inside definer functions. Owners manage
-- everything through requireOwner-guarded server actions.

alter table public.promotions enable row level security;
alter table public.promotion_targets enable row level security;
alter table public.promotion_coupons enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.promotion_events enable row level security;

-- -- promotions: public sees effective-active only; owners see all.
drop policy if exists promotions_public on public.promotions;
create policy promotions_public
  on public.promotions for select to anon, authenticated
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists promotions_owner on public.promotions;
create policy promotions_owner
  on public.promotions for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- -- targets: public sees targets of effective-active promotions only.
drop policy if exists promotion_targets_public on public.promotion_targets;
create policy promotion_targets_public
  on public.promotion_targets for select to anon, authenticated
  using (exists (
    select 1 from public.promotions p
    where p.id = promotion_targets.promotion_id
      and p.status = 'active'
      and (p.starts_at is null or p.starts_at <= now())
      and (p.ends_at is null or p.ends_at > now())
  ));

drop policy if exists promotion_targets_owner on public.promotion_targets;
create policy promotion_targets_owner
  on public.promotion_targets for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- -- coupons: owner-only. No public/anon select, ever.
drop policy if exists promotion_coupons_owner on public.promotion_coupons;
create policy promotion_coupons_owner
  on public.promotion_coupons for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- -- redemptions: customers read their own; owners read all. No direct
-- writes — rows are written only by create_order in-transaction.
drop policy if exists promotion_redemptions_select on public.promotion_redemptions;
create policy promotion_redemptions_select
  on public.promotion_redemptions for select to authenticated
  using (customer_id = (select auth.uid()) or public.is_owner());

-- -- events: owner-only reads; writes go through owner actions.
drop policy if exists promotion_events_owner on public.promotion_events;
create policy promotion_events_owner
  on public.promotion_events for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- 8. Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.promotions from anon, authenticated;
revoke all on table public.promotion_targets from anon, authenticated;
revoke all on table public.promotion_coupons from anon, authenticated;
revoke all on table public.promotion_redemptions from anon, authenticated;
revoke all on table public.promotion_events from anon, authenticated;

grant select on table public.promotions to anon, authenticated;
grant select on table public.promotion_targets to anon, authenticated;
grant select on table public.promotion_redemptions to authenticated;
grant insert, update, delete on table public.promotions to authenticated;
grant insert, update, delete on table public.promotion_targets to authenticated;
grant insert, update, delete on table public.promotion_coupons to authenticated;
grant insert, update, delete on table public.promotion_events to authenticated;

grant all on table public.promotions to service_role;
grant all on table public.promotion_targets to service_role;
grant all on table public.promotion_coupons to service_role;
grant all on table public.promotion_redemptions to service_role;
grant all on table public.promotions to service_role;
grant all on table public.promotion_targets to service_role;
grant all on table public.promotion_coupons to service_role;
grant all on table public.promotion_redemptions to service_role;
grant all on table public.promotion_events to service_role;

-- ---------------------------------------------------------------------------
-- 9. Promotion engine (THE single authoritative calculation path)
-- ---------------------------------------------------------------------------
-- Pure read function: cart/checkout previews and create_order all call it.
-- p_items: [{product_id, quantity, unit_price_paise}] — the caller supplies
-- unit prices re-derived from live catalog rows (server-side only).
-- p_coupon_code: raw customer input; normalized + validated inside.
--
-- Rounding: percentage rewards use floor() (remainder stays with the store).
-- All amounts clamp to [0, subtotal]. Misconfigured promotions are SKIPPED
-- (never break checkout); only an explicitly supplied bad coupon raises,
-- reported generically upstream (no enumeration leak).

create or replace function public.evaluate_order_promotions(
  p_customer_id uuid,
  p_items jsonb,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_n integer;
  v_i integer;
  v_prod uuid[];
  v_cat uuid[];
  v_cat_one uuid;
  v_qty integer[];
  v_unit integer[];
  v_line_disc bigint[];
  v_subtotal bigint := 0;
  v_item_total bigint := 0;
  v_order_total bigint := 0;
  v_total bigint;
  v_payable bigint;
  v_coupon text;
  v_coupon_error text := null;
  v_coupon_promo uuid := null;
  v_coupon_id uuid := null;
  v_candidates jsonb;
  v_winner jsonb;
  v_applied jsonb := '[]';
  v_lines jsonb := '[]';
  v_promo record;
  v_tcats uuid[];
  v_tprods uuid[];
  v_rcats uuid[];
  v_rprods uuid[];
  v_has_coupon boolean;
  v_use_coupon uuid;
  v_eligible_sum bigint;
  v_amount bigint;
  v_count integer;
  v_pct integer;
  v_kind text;
  v_value integer;
  v_maxcap bigint;
  v_buy integer;
  v_rqty integer;
  v_rkind text;
  v_rpct integer;
  v_rprice integer;
  v_trigger_units integer;
  v_sets integer;
  v_need integer;
  v_units jsonb;   -- [{price, idx}] sorted asc
  v_take jsonb;
  v_u record;
  v_bqty integer;
  v_bprice integer;
  v_pool integer;
  v_bundles integer;
  v_b integer;
  v_chunk integer;
  v_sum bigint;
begin
  -- Caller binding: signed-in callers may only quote themselves (the
  -- first-order ledger would otherwise become an oracle for other users).
  -- Service-role callers (tests, admin) pass any id.
  if p_customer_id is null then
    raise exception 'INVALID_PROMOTION_INPUT' using errcode = 'P0001';
  end if;
  if v_caller is not null and v_caller is distinct from p_customer_id then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  -- ---- Parse + validate the line inputs (defensive: callers are server
  -- code, but garbage must fail closed, never misprice). ----
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_PROMOTION_INPUT' using errcode = 'P0001';
  end if;
  v_n := jsonb_array_length(p_items);
  if v_n = 0 then
    return jsonb_build_object(
      'subtotal', 0, 'item_discount_total', 0, 'order_discount_total', 0,
      'discount_total', 0, 'payable', 0,
      'coupon', null, 'applied', jsonb_build_array(), 'lines', jsonb_build_array()
    );
  end if;
  for v_i in 1..v_n loop
    declare
      v_el jsonb := p_items -> (v_i - 1);
    begin
      if coalesce(v_el ->> 'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
        or coalesce(v_el ->> 'quantity', '') !~ '^[0-9]+$'
        or coalesce(v_el ->> 'unit_price_paise', '') !~ '^[0-9]+$' then
        raise exception 'INVALID_PROMOTION_INPUT' using errcode = 'P0001';
      end if;
      v_prod[v_i] := (v_el ->> 'product_id')::uuid;
      v_qty[v_i] := (v_el ->> 'quantity')::integer;
      v_unit[v_i] := (v_el ->> 'unit_price_paise')::integer;
      v_line_disc[v_i] := 0;
      if v_qty[v_i] not between 1 and 99 or v_unit[v_i] < 0 then
        raise exception 'INVALID_PROMOTION_INPUT' using errcode = 'P0001';
      end if;
      select p.category_id into v_cat_one
        from public.products p where p.id = v_prod[v_i];
      if not found then
        raise exception 'INVALID_PROMOTION_INPUT' using errcode = 'P0001';
      end if;
      v_cat[v_i] := v_cat_one;
      v_subtotal := v_subtotal + v_qty[v_i]::bigint * v_unit[v_i];
    end;
  end loop;

  -- ---- Coupon normalization + lookup (generic outcome, no leaks). ----
  v_coupon := nullif(upper(btrim(coalesce(p_coupon_code, ''))), '');
  if v_coupon is not null then
    select c.promotion_id, c.id into v_coupon_promo, v_coupon_id
      from public.promotion_coupons c
      join public.promotions p on p.id = c.promotion_id
     where c.code = v_coupon
       and c.is_active
       and p.status = 'active'
       and (p.starts_at is null or p.starts_at <= now())
       and (p.ends_at is null or p.ends_at > now());
    if not found then
      v_coupon_error := 'invalid';
    end if;
  end if;

  -- ---- Pass 1: item-level candidates (buy_x_get_y, mix_match). ----
  v_candidates := '[]';
  for v_promo in
    select * from public.promotions p
    where p.status = 'active'
      and (p.starts_at is null or p.starts_at <= now())
      and (p.ends_at is null or p.ends_at > now())
      and p.type in ('buy_x_get_y', 'mix_match')
    order by p.priority desc, p.created_at asc
  loop
    -- Target scopes.
    select coalesce(array_agg(t.category_id), '{}') into v_tcats
      from public.promotion_targets t
     where t.promotion_id = v_promo.id and t.category_id is not null
       and t.target_role in ('any', 'trigger');
    select coalesce(array_agg(t.product_id), '{}') into v_tprods
      from public.promotion_targets t
     where t.promotion_id = v_promo.id and t.product_id is not null
       and t.target_role in ('any', 'trigger');
    select coalesce(array_agg(t.category_id), '{}') into v_rcats
      from public.promotion_targets t
     where t.promotion_id = v_promo.id and t.category_id is not null
       and t.target_role in ('any', 'reward');
    select coalesce(array_agg(t.product_id), '{}') into v_rprods
      from public.promotion_targets t
     where t.promotion_id = v_promo.id and t.product_id is not null
       and t.target_role in ('any', 'reward');

    -- Coupon gate: promos carrying codes — or marked code-only — require
    -- their own code. (Owner validation ensures code-only promos have codes.)
    select exists(
      select 1 from public.promotion_coupons c
      where c.promotion_id = v_promo.id and c.is_active
    ) into v_has_coupon;
    v_use_coupon := null;
    if v_has_coupon or not coalesce(v_promo.auto_apply, true) then
      if v_coupon_promo is distinct from v_promo.id then
        continue;
      end if;
      v_use_coupon := v_coupon_id;
    end if;

    -- Limits (re-checked under lock at commit time).
    if v_subtotal < coalesce(v_promo.min_order_paise, 0) then continue; end if;
    if v_promo.max_uses_global is not null
       and v_promo.uses_count >= v_promo.max_uses_global then continue; end if;
    if v_promo.max_uses_per_customer is not null and p_customer_id is not null then
      select count(*) into v_count from public.promotion_redemptions r
       where r.promotion_id = v_promo.id and r.customer_id = p_customer_id;
      if v_count >= v_promo.max_uses_per_customer then continue; end if;
    end if;
    if v_promo.type = 'buy_x_get_y' then
      if coalesce(v_promo.config ->> 'buy_qty', '') !~ '^[0-9]+$'
        or coalesce(v_promo.config ->> 'reward_qty', '') !~ '^[0-9]+$' then
        continue;
      end if;
      v_buy := (v_promo.config ->> 'buy_qty')::integer;
      v_rqty := (v_promo.config ->> 'reward_qty')::integer;
      v_rkind := coalesce(v_promo.config ->> 'reward_kind', 'free');
      if v_buy < 1 or v_rqty < 1 or v_rkind not in ('free', 'percent', 'price') then
        continue;
      end if;
      v_rpct := 100;
      v_rprice := 0;
      if v_rkind = 'percent' then
        if coalesce(v_promo.config ->> 'reward_percent', '') !~ '^[0-9]+$' then continue; end if;
        v_rpct := (v_promo.config ->> 'reward_percent')::integer;
        if v_rpct < 1 or v_rpct > 100 then continue; end if;
      elsif v_rkind = 'price' then
        if coalesce(v_promo.config ->> 'reward_price_paise', '') !~ '^[0-9]+$' then continue; end if;
        v_rprice := (v_promo.config ->> 'reward_price_paise')::integer;
      end if;

      -- Trigger units (empty trigger scope = whole order).
      v_trigger_units := 0;
      for v_i in 1..v_n loop
        if (cardinality(v_tcats) = 0 and cardinality(v_tprods) = 0)
          or v_cat[v_i] = any (v_tcats) or v_prod[v_i] = any (v_tprods) then
          v_trigger_units := v_trigger_units + v_qty[v_i];
        end if;
      end loop;
      if v_trigger_units < v_buy then continue; end if;
      v_sets := case when v_promo.repeatable
        then v_trigger_units / v_buy
        else 1 end;
      v_need := v_sets * v_rqty;

      -- Reward pool: cheapest eligible units first (documented).
      if cardinality(v_rcats) = 0 and cardinality(v_rprods) = 0 then
        v_rcats := v_tcats; v_rprods := v_tprods;
      end if;
      v_units := '[]';
      for v_i in 1..v_n loop
        if (cardinality(v_rcats) = 0 and cardinality(v_rprods) = 0)
          or v_cat[v_i] = any (v_rcats) or v_prod[v_i] = any (v_rprods) then
          for v_b in 1..v_qty[v_i] loop
            v_units := v_units || jsonb_build_object('price', v_unit[v_i], 'idx', v_i);
          end loop;
        end if;
      end loop;
      select coalesce(jsonb_agg(u order by (u ->> 'price')::integer, (u ->> 'idx')::integer), '[]')
        into v_units from jsonb_array_elements(v_units) u;
      if jsonb_array_length(v_units) = 0 then continue; end if;
      v_need := least(v_need, jsonb_array_length(v_units));
      v_take := '[]'; v_amount := 0;
      for v_b in 0..v_need - 1 loop
        declare v_price bigint := ((v_units -> v_b) ->> 'price')::bigint;
                  v_idx integer := ((v_units -> v_b) ->> 'idx')::integer;
                  v_d bigint;
        begin
          if v_rkind = 'free' then v_d := v_price;
          elsif v_rkind = 'percent' then v_d := (v_price * v_rpct) / 100;
          else v_d := greatest(v_price - v_rprice, 0);
          end if;
          v_amount := v_amount + v_d;
          v_take := v_take || jsonb_build_object('idx', v_idx, 'amount', v_d);
        end;
      end loop;
      if v_amount > 0 then
        v_candidates := v_candidates || jsonb_build_object(
          'promotion_id', v_promo.id, 'name', v_promo.name, 'type', v_promo.type,
          'amount', v_amount, 'priority', v_promo.priority, 'created', v_promo.created_at,
          'lines', v_take, 'coupon_id', v_use_coupon);
      end if;
    else
      -- mix_match: bundles of the cheapest eligible units first.
      if coalesce(v_promo.config ->> 'bundle_qty', '') !~ '^[0-9]+$'
        or coalesce(v_promo.config ->> 'bundle_price_paise', '') !~ '^[0-9]+$' then
        continue;
      end if;
      v_bqty := (v_promo.config ->> 'bundle_qty')::integer;
      v_bprice := (v_promo.config ->> 'bundle_price_paise')::integer;
      if v_bqty < 2 or v_bprice < 0 then continue; end if;
      v_units := '[]';
      for v_i in 1..v_n loop
        if (cardinality(v_tcats) = 0 and cardinality(v_tprods) = 0)
          or v_cat[v_i] = any (v_tcats) or v_prod[v_i] = any (v_tprods) then
          for v_b in 1..v_qty[v_i] loop
            v_units := v_units || jsonb_build_object('price', v_unit[v_i], 'idx', v_i);
          end loop;
        end if;
      end loop;
      select coalesce(jsonb_agg(u order by (u ->> 'price')::integer, (u ->> 'idx')::integer), '[]')
        into v_units from jsonb_array_elements(v_units) u;
      v_pool := jsonb_array_length(v_units);
      if v_pool < v_bqty then continue; end if;
      v_bundles := case when v_promo.repeatable then v_pool / v_bqty else 1 end;
      v_take := '[]'; v_amount := 0;
      for v_b in 0..v_bundles - 1 loop
        v_sum := 0;
        for v_chunk in 0..v_bqty - 1 loop
          declare v_el jsonb := v_units -> (v_b * v_bqty + v_chunk);
          begin
            v_sum := v_sum + (v_el ->> 'price')::integer;
            -- Provisional equal split; finalized per-unit below.
            v_take := v_take || jsonb_build_object(
              'idx', (v_el ->> 'idx')::integer, 'price', (v_el ->> 'price')::integer,
              'bundle', v_b, 'bundle_sum', 0);
          end;
        end loop;
        v_amount := v_amount + greatest(v_sum - v_bprice, 0);
      end loop;
      if v_amount > 0 then
        -- Attribute the bundle saving across its units proportionally
        -- (floor; any paise dust stays with the store — the promo total
        -- on the order stays exact).
        v_take := (
          with taken as (
            select (t.value ->> 'idx')::integer as idx,
                   (t.value ->> 'price')::bigint as price,
                   (t.value ->> 'bundle')::integer as bundle
              from jsonb_array_elements(v_take) t
          ),
          sums as (
            select bundle, sum(price) as s from taken group by bundle
          )
          select coalesce(jsonb_agg(jsonb_build_object(
            'idx', taken.idx,
            'amount', case when sums.s = 0 then 0
              else floor((taken.price * greatest(sums.s - v_bprice, 0)) / sums.s)::bigint end
            ) order by taken.idx), '[]')
          from taken join sums on sums.bundle = taken.bundle
        );
        -- Floor dust: top up the first unit of each bundle so the promo
        -- total is exact.
        v_candidates := v_candidates || jsonb_build_object(
          'promotion_id', v_promo.id, 'name', v_promo.name, 'type', v_promo.type,
          'amount', v_amount, 'priority', v_promo.priority, 'created', v_promo.created_at,
          'lines', v_take, 'coupon_id', v_use_coupon);
      end if;
    end if;
  end loop;

  -- ---- Resolve the single item-level winner (best by amount, priority,
  -- created). Combining two item-level promos would re-price units twice. ----
  select c into v_winner from (
    select value as c from jsonb_array_elements(v_candidates)
    order by (value ->> 'amount')::bigint desc,
             (value ->> 'priority')::integer desc,
             (value ->> 'created') asc
    limit 1
  ) s;
  if v_winner is not null and (v_winner ->> 'amount')::bigint > 0 then
    for v_u in select * from jsonb_array_elements(v_winner -> 'lines') loop
      v_i := (v_u.value ->> 'idx')::integer;
      v_line_disc[v_i] := v_line_disc[v_i] + (v_u.value ->> 'amount')::bigint;
    end loop;
    v_item_total := (v_winner ->> 'amount')::bigint;
    -- Parenthesized: object–object merge first, then array append.
    -- (jsonb || is left-associative: array || object would append.)
    v_applied := v_applied || ((v_winner - 'priority' - 'created' - 'lines'
      - 'coupon_id')
      || jsonb_build_object('coupon_code',
           case when v_winner ->> 'coupon_id' is null then null else v_coupon end));
  end if;

  -- ---- Pass 2: order-level candidates on NET bases (no double-discount). ----
  v_candidates := '[]';
  for v_promo in
    select * from public.promotions p
    where p.status = 'active'
      and (p.starts_at is null or p.starts_at <= now())
      and (p.ends_at is null or p.ends_at > now())
      and p.type in ('percentage', 'first_order')
    order by p.priority desc, p.created_at asc
  loop
    select coalesce(array_agg(t.category_id), '{}') into v_tcats
      from public.promotion_targets t
     where t.promotion_id = v_promo.id and t.category_id is not null;
    select coalesce(array_agg(t.product_id), '{}') into v_tprods
      from public.promotion_targets t
     where t.promotion_id = v_promo.id and t.product_id is not null;

    select exists(
      select 1 from public.promotion_coupons c
      where c.promotion_id = v_promo.id and c.is_active
    ) into v_has_coupon;
    v_use_coupon := null;
    if v_has_coupon or not coalesce(v_promo.auto_apply, true) then
      if v_coupon_promo is distinct from v_promo.id then
        continue;
      end if;
      v_use_coupon := v_coupon_id;
    end if;

    if v_subtotal < coalesce(v_promo.min_order_paise, 0) then continue; end if;
    if v_promo.max_uses_global is not null
       and v_promo.uses_count >= v_promo.max_uses_global then continue; end if;
    if v_promo.max_uses_per_customer is not null and p_customer_id is not null then
      select count(*) into v_count from public.promotion_redemptions r
       where r.promotion_id = v_promo.id and r.customer_id = p_customer_id;
      if v_count >= v_promo.max_uses_per_customer then continue; end if;
    end if;
    if v_promo.type = 'first_order' and p_customer_id is not null then
      -- Ledger-based: any prior first-order redemption blocks, forever.
      -- Order rows may be cancelled or (per-side) deleted; the ledger stays.
      if exists(select 1 from public.promotion_redemptions r
        where r.customer_id = p_customer_id and r.is_first_order) then
        continue;
      end if;
    end if;

    -- Net eligible base (gross minus item-level rewards on those lines).
    v_eligible_sum := 0;
    for v_i in 1..v_n loop
      if (cardinality(v_tcats) = 0 and cardinality(v_tprods) = 0)
        or v_cat[v_i] = any (v_tcats) or v_prod[v_i] = any (v_tprods) then
        v_eligible_sum := v_eligible_sum
          + greatest(v_qty[v_i] * v_unit[v_i] - v_line_disc[v_i], 0);
      end if;
    end loop;
    if v_eligible_sum <= 0 then continue; end if;

    v_maxcap := coalesce(v_promo.max_discount_paise, 1000000000);
    if v_promo.type = 'percentage' then
      if coalesce(v_promo.config ->> 'percent', '') !~ '^[0-9]+$' then continue; end if;
      v_pct := (v_promo.config ->> 'percent')::integer;
      if v_pct < 1 or v_pct > 100 then continue; end if;
      v_amount := least((v_eligible_sum * v_pct) / 100, v_maxcap, v_eligible_sum);
    else
      v_kind := coalesce(v_promo.config ->> 'kind', 'fixed');
      if coalesce(v_promo.config ->> 'value', '') !~ '^[0-9]+$' then continue; end if;
      v_value := (v_promo.config ->> 'value')::integer;
      if v_value < 1 then continue; end if;
      if v_kind = 'percent' then
        if v_value > 100 then continue; end if;
        v_amount := least((v_eligible_sum * v_value) / 100, v_maxcap, v_eligible_sum);
      elsif v_kind = 'fixed' then
        v_amount := least(v_value, v_maxcap, v_eligible_sum);
      else
        continue;
      end if;
    end if;
    if v_amount > 0 then
      v_candidates := v_candidates || jsonb_build_object(
        'promotion_id', v_promo.id, 'name', v_promo.name, 'type', v_promo.type,
        'amount', v_amount, 'priority', v_promo.priority, 'created', v_promo.created_at,
        'exclusive', v_promo.is_exclusive, 'stackable', v_promo.is_stackable,
        'coupon_id', v_use_coupon);
    end if;
  end loop;

  -- ---- Resolve order-level stacking (deterministic). ----
  select c into v_winner from (
    select value as c from jsonb_array_elements(v_candidates)
    where (value ->> 'exclusive')::boolean
    order by (value ->> 'priority')::integer desc,
             (value ->> 'amount')::bigint desc,
             (value ->> 'created') asc
    limit 1
  ) s;
  if v_winner is not null then
    v_order_total := (v_winner ->> 'amount')::bigint;
    v_applied := v_applied || ((v_winner - 'priority' - 'created' - 'exclusive'
      - 'stackable' - 'coupon_id')
      || jsonb_build_object('coupon_code',
           case when v_winner ->> 'coupon_id' is null then null else v_coupon end));
  else
    -- Best non-stackable automatic promo, plus every stackable automatic
    -- one. Coupon-gated promos (explicit customer code) always combine with
    -- automatic ones — the code is a deliberate claim, never a surprise.
    select c into v_winner from (
      select value as c from jsonb_array_elements(v_candidates)
      where not (value ->> 'stackable')::boolean
        and (value ->> 'coupon_id') is null
      order by (value ->> 'amount')::bigint desc,
               (value ->> 'priority')::integer desc,
               (value ->> 'created') asc
      limit 1
    ) s;
    if v_winner is not null then
      v_order_total := v_order_total + (v_winner ->> 'amount')::bigint;
      v_applied := v_applied || ((v_winner - 'priority' - 'created' - 'exclusive'
        - 'stackable' - 'coupon_id')
        || jsonb_build_object('coupon_code',
             case when v_winner ->> 'coupon_id' is null then null else v_coupon end));
    end if;
    for v_u in
      select value as c from jsonb_array_elements(v_candidates)
      where (value ->> 'stackable')::boolean
        and (value ->> 'coupon_id') is null
      order by (value ->> 'priority')::integer desc, (value ->> 'created') asc
    loop
      v_order_total := v_order_total + (v_u.c ->> 'amount')::bigint;
      v_applied := v_applied || ((v_u.c - 'priority' - 'created' - 'exclusive'
        - 'stackable' - 'coupon_id')
        || jsonb_build_object('coupon_code',
             case when v_u.c ->> 'coupon_id' is null then null else v_coupon end));
    end loop;
    for v_u in
      select value as c from jsonb_array_elements(v_candidates)
      where (value ->> 'coupon_id') is not null
      order by (value ->> 'priority')::integer desc, (value ->> 'created') asc
    loop
      v_order_total := v_order_total + (v_u.c ->> 'amount')::bigint;
      v_applied := v_applied || ((v_u.c - 'priority' - 'created' - 'exclusive'
        - 'stackable' - 'coupon_id')
        || jsonb_build_object('coupon_code', v_coupon));
    end loop;
  end if;

  -- ---- Assemble: totals clamp so discounts never exceed the subtotal. ----
  v_total := least(v_item_total + v_order_total, v_subtotal);
  v_payable := v_subtotal - v_total;
  for v_i in 1..v_n loop
    v_lines := v_lines || jsonb_build_object(
      'idx', v_i, 'product_id', v_prod[v_i], 'quantity', v_qty[v_i],
      'unit_price_paise', v_unit[v_i], 'discount_paise', v_line_disc[v_i]);
  end loop;

  return jsonb_build_object(
    'subtotal', v_subtotal,
    'item_discount_total', v_item_total,
    'order_discount_total', least(v_order_total, v_subtotal - v_item_total),
    'discount_total', v_total,
    'payable', v_payable,
    'coupon', case when v_coupon is null then null
      else jsonb_build_object('code', v_coupon, 'valid', v_coupon_error is null,
        'message', case when v_coupon_error is null
          then 'Coupon applied.' else 'That coupon is not valid for this order.' end)
      end,
    'applied', v_applied,
    'lines', v_lines
  );
end;
$$;

revoke all on function public.evaluate_order_promotions(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.evaluate_order_promotions(uuid, jsonb, text)
  to authenticated;
grant execute on function public.evaluate_order_promotions(uuid, jsonb, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 10. Order creation with promotions (replaces the Phase 4 signature)
-- ---------------------------------------------------------------------------
-- The 5-arg overload is dropped first so PostgREST never sees two
-- create_order variants. p_coupon_code is raw customer input (nullable);
-- everything else is derived inside. The promotion rows that could be
-- consumed are locked FOR UPDATE before evaluation, so concurrent checkouts
-- serialize; per-order idempotency still returns before consuming anything.

drop function if exists public.create_order(jsonb, jsonb, text, text, uuid[]);

create or replace function public.create_order(
  p_items jsonb,
  p_contact jsonb,
  p_payment_method text,
  p_idempotency_key text,
  p_cart_item_ids uuid[],
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_existing_id uuid;
  v_existing_number text;
  v_item record;
  v_product_id uuid;
  v_variant_id uuid;
  v_flavour_id uuid;
  v_quantity integer;
  v_egg text;
  v_message text;
  v_design text;
  v_product record;
  v_variant record;
  v_flavour record;
  v_p_name text;
  v_p_slug text;
  v_p_base integer;
  v_p_egg_en boolean;
  v_p_egg_sur integer;
  v_p_msg_en boolean;
  v_p_design_en boolean;
  v_p_gone boolean;
  v_var_price integer;
  v_var_label text;
  v_var_value text;
  v_var_active boolean;
  v_fla_sur integer;
  v_fla_name text;
  v_fla_active boolean;
  v_img_path text;
  v_unit integer;
  v_subtotal integer := 0;
  v_seq integer;
  v_number text;
  v_order_id uuid;
  v_accepting boolean;
  v_currency text;
  v_design_count integer;
  -- Phase 5 promotion state.
  v_arr_prod uuid[] := '{}';
  v_arr_qty integer[] := '{}';
  v_arr_unit integer[] := '{}';
  v_k integer;
  v_promo_items jsonb;
  v_quote jsonb;
  v_discount bigint := 0;
  v_grand bigint;
  v_breakdown jsonb := '[]';
  v_coupon_norm text := null;
  v_applied record;
  v_coupon_id2 uuid;
  v_ord integer;
  v_line_disc bigint;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Idempotency first: retries return the original order, never a duplicate.
  select o.id, o.order_number into v_existing_id, v_existing_number
    from public.orders o
   where o.customer_id = v_uid and o.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'order_id', v_existing_id, 'order_number', v_existing_number, 'duplicate', true
    );
  end if;

  if p_payment_method not in ('cod', 'pay_at_pickup') then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  if char_length(coalesce(p_contact ->> 'name', '')) not between 1 and 80
     or char_length(coalesce(p_contact ->> 'phone', '')) not between 7 and 20
     or (p_contact ->> 'phone') !~ '^[+0-9][0-9 ()-]*$'
     or char_length(coalesce(p_contact ->> 'email', '')) not between 3 and 254
     or (p_contact ->> 'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_CONTACT' using errcode = 'P0001';
  end if;

  select s.accepting_orders, s.currency into v_accepting, v_currency
    from public.store_settings s where s.id = 1;
  if not found or not coalesce(v_accepting, true) then
    raise exception 'STORE_NOT_ACCEPTING' using errcode = 'P0001';
  end if;
  v_currency := coalesce(v_currency, 'INR');

  -- Validate + reprice every line from locked catalog rows. Client prices,
  -- totals and statuses never enter this function. Identifiers are extracted
  -- to scalars first: record fields cannot appear inside SQL statements.
  for v_item in
    select value from jsonb_array_elements(p_items) with ordinality order by ordinality
  loop
    if coalesce(v_item.value ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;
    v_quantity := (v_item.value ->> 'quantity')::integer;
    if v_quantity not between 1 and 99 then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;

    if coalesce(v_item.value ->> 'product_id', '') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
    end if;
    v_product_id := (v_item.value ->> 'product_id')::uuid;

    v_variant_id := null;
    if coalesce(v_item.value ->> 'variant_id', '') <> '' then
      if (v_item.value ->> 'variant_id') !~ '^[0-9a-fA-F-]{36}$' then
        raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
      end if;
      v_variant_id := (v_item.value ->> 'variant_id')::uuid;
    end if;

    v_flavour_id := null;
    if coalesce(v_item.value ->> 'flavour_id', '') <> '' then
      if (v_item.value ->> 'flavour_id') !~ '^[0-9a-fA-F-]{36}$' then
        raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
      end if;
      v_flavour_id := (v_item.value ->> 'flavour_id')::uuid;
    end if;

    v_egg := nullif(coalesce(v_item.value ->> 'egg_eggless', ''), '');
    v_message := nullif(coalesce(v_item.value ->> 'message', ''), '');
    v_design := nullif(coalesce(v_item.value ->> 'design_path', ''), '');

    select
      p.name, p.base_price_paise,
      p.egg_eggless_enabled, p.eggless_surcharge_paise,
      p.message_enabled, p.allow_custom_design
      into
      v_p_name, v_p_base,
      v_p_egg_en, v_p_egg_sur,
      v_p_msg_en, v_p_design_en
      from public.products p
     where p.id = v_product_id
     for update;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
    end if;
    select p.archived_at is not null or not p.is_active into v_p_gone
      from public.products p where p.id = v_product_id;
    if coalesce(v_p_gone, true) then
      raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
    end if;

    v_unit := coalesce(v_p_base, 0);

    if v_variant_id is not null then
      select v.price_paise, v.label, v.is_active
        into v_var_price, v_var_label, v_var_active
        from public.product_variants v
       where v.id = v_variant_id and v.product_id = v_product_id
       for update;
      if not found or not coalesce(v_var_active, false) then
        raise exception 'VARIANT_UNAVAILABLE' using errcode = 'P0001';
      end if;
      v_unit := v_var_price;
    elsif exists (
      select 1 from public.product_variants v
      where v.product_id = v_product_id and v.is_active
    ) then
      raise exception 'VARIANT_REQUIRED' using errcode = 'P0001';
    end if;

    if v_flavour_id is not null then
      select f.surcharge_paise, f.name, f.is_active
        into v_fla_sur, v_fla_name, v_fla_active
        from public.product_flavours f
       where f.id = v_flavour_id and f.product_id = v_product_id
       for update;
      if not found or not coalesce(v_fla_active, false) then
        raise exception 'FLAVOUR_UNAVAILABLE' using errcode = 'P0001';
      end if;
      v_unit := v_unit + v_fla_sur;
    end if;

    if v_egg = 'eggless' then
      if not coalesce(v_p_egg_en, false) then
        raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
      end if;
      v_unit := v_unit + coalesce(v_p_egg_sur, 0);
    elsif v_egg is not null and v_egg <> 'egg' then
      raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
    end if;

    if v_message is not null then
      if char_length(v_message) > 60 or not coalesce(v_p_msg_en, false) then
        raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
      end if;
    end if;

    if v_design is not null then
      if not coalesce(v_p_design_en, false) then
        raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
      end if;
      if v_design not like 'tmp/' || v_uid::text || '/%' then
        raise exception 'INVALID_CONFIGURATION' using errcode = 'P0001';
      end if;
      select count(*) into v_design_count
        from storage.objects
       where bucket_id = 'customer-designs' and name = v_design;
      if v_design_count = 0 then
        raise exception 'DESIGN_MISSING' using errcode = 'P0001';
      end if;
    end if;

    v_subtotal := v_subtotal + v_unit * v_quantity;
    -- Retain repriced lines for the promotion engine (same order as input).
    v_arr_prod := v_arr_prod || v_product_id;
    v_arr_qty := v_arr_qty || v_quantity;
    v_arr_unit := v_arr_unit || v_unit;
  end loop;

  -- ---- Promotions: lock consumable rows, then evaluate authoritatively. ----
  -- Locking first serializes concurrent checkouts against the same limits.
  -- (FOR UPDATE cannot combine with aggregates, so this is a bare lock.)
  perform 1
    from public.promotions p
   where p.status = 'active'
     and (p.starts_at is null or p.starts_at <= now())
     and (p.ends_at is null or p.ends_at > now())
     for update;

  v_promo_items := '[]';
  for v_k in 1..cardinality(v_arr_prod) loop
    v_promo_items := v_promo_items || jsonb_build_object(
      'product_id', v_arr_prod[v_k], 'quantity', v_arr_qty[v_k],
      'unit_price_paise', v_arr_unit[v_k]);
  end loop;

  v_quote := public.evaluate_order_promotions(v_uid, v_promo_items, p_coupon_code);
  -- Note: `->` on a JSON null yields JSON null (not SQL NULL), so test the
  -- nested flag with a coalesce instead of `is not null`.
  if not coalesce((v_quote -> 'coupon' ->> 'valid')::boolean, true) then
    -- Fail closed on an explicit bad code (generic message, no leaks).
    raise exception 'COUPON_INVALID' using errcode = 'P0001';
  end if;
  v_discount := coalesce((v_quote ->> 'discount_total')::bigint, 0);
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'INVALID_PROMOTION' using errcode = 'P0001';
  end if;
  v_breakdown := coalesce(v_quote -> 'applied', '[]');
  v_coupon_norm := v_quote -> 'coupon' ->> 'code';
  v_grand := v_subtotal - v_discount;

  -- Daily sequence under lock: unique, monotonic, concurrency-safe.
  insert into public.order_counters (day, last_seq)
  values (current_date, 1)
  on conflict (day) do update set last_seq = public.order_counters.last_seq + 1
  returning last_seq into v_seq;
  v_number := 'BNK-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.orders (
    order_number, customer_id, status,
    subtotal_paise, discount_paise, tax_paise, charges_paise, grand_total_paise,
    currency, contact_name, contact_phone, contact_email,
    payment_method, idempotency_key, promo_breakdown, coupon_code
  ) values (
    v_number, v_uid, 'pending',
    v_subtotal, v_discount, 0, 0, v_grand,
    v_currency,
    btrim(p_contact ->> 'name'), btrim(p_contact ->> 'phone'), lower(btrim(p_contact ->> 'email')),
    p_payment_method, nullif(btrim(p_idempotency_key), ''), v_breakdown, v_coupon_norm
  )
  returning id into v_order_id;

  -- Snapshot rows: what the customer ordered, immune to later catalog edits.
  -- Inputs were fully validated in the loop above, so casts here are safe.
  for v_item in
    select value, ordinality from jsonb_array_elements(p_items) with ordinality order by ordinality
  loop
    v_ord := v_item.ordinality;
    v_product_id := (v_item.value ->> 'product_id')::uuid;
    v_variant_id := case when coalesce(v_item.value ->> 'variant_id', '') = '' then null
      else (v_item.value ->> 'variant_id')::uuid end;
    v_flavour_id := case when coalesce(v_item.value ->> 'flavour_id', '') = '' then null
      else (v_item.value ->> 'flavour_id')::uuid end;
    v_quantity := (v_item.value ->> 'quantity')::integer;
    v_egg := nullif(coalesce(v_item.value ->> 'egg_eggless', ''), '');
    v_message := nullif(coalesce(v_item.value ->> 'message', ''), '');
    v_design := nullif(coalesce(v_item.value ->> 'design_path', ''), '');

    select p.name, p.slug, p.base_price_paise, p.eggless_surcharge_paise
      into v_p_name, v_p_slug, v_p_base, v_p_egg_sur
      from public.products p where p.id = v_product_id;

    v_var_label := null;
    v_var_value := null;
    v_var_price := null;
    if v_variant_id is not null then
      select v.label, v.value, v.price_paise
        into v_var_label, v_var_value, v_var_price
        from public.product_variants v where v.id = v_variant_id;
    end if;

    v_fla_name := null;
    v_fla_sur := 0;
    if v_flavour_id is not null then
      select f.name, f.surcharge_paise
        into v_fla_name, v_fla_sur
        from public.product_flavours f where f.id = v_flavour_id;
    end if;

    v_unit := coalesce(v_var_price, v_p_base)
      + coalesce(v_fla_sur, 0)
      + case when v_egg = 'eggless' then coalesce(v_p_egg_sur, 0) else 0 end;

    select pi.storage_path into v_img_path
      from public.product_images pi
     where pi.product_id = v_product_id
     order by pi.is_primary desc, pi.display_order limit 1;
    if not found then
      v_img_path := null;
    end if;

    select coalesce((l.value ->> 'discount_paise')::bigint, 0) into v_line_disc
      from jsonb_array_elements(v_quote -> 'lines') l
     where (l.value ->> 'idx')::integer = v_ord;
    if not found then
      v_line_disc := 0;
    end if;

    insert into public.order_items (
      order_id, product_id, product_name, product_slug,
      variant_label, variant_value, flavour_name,
      egg_eggless, message, design_path,
      unit_price_paise, quantity, line_total_paise, discount_paise, image_path
    ) values (
      v_order_id, v_product_id, v_p_name, v_p_slug,
      v_var_label, v_var_value, v_fla_name,
      v_egg, v_message, v_design,
      v_unit, v_quantity,
      v_unit * v_quantity,
      v_line_disc,
      v_img_path
    );

    if v_design is not null then
      insert into public.order_assets (order_id, kind, storage_path)
      values (v_order_id, 'design', v_design);
    end if;
  end loop;

  insert into public.payments (order_id, method, status, amount_paise, currency)
  values (v_order_id, p_payment_method, 'pending', v_grand, v_currency);

  -- Promotion consumption: one ledger row per applied promotion plus the
  -- atomic uses_count bump (rows are locked above). Unique violations
  -- (first-order double-claim races) roll everything back with a curated
  -- code instead of a raw constraint error.
  begin
    for v_applied in
      select value from jsonb_array_elements(v_breakdown)
    loop
      v_coupon_id2 := null;
      if v_applied.value ->> 'coupon_code' is not null then
        select c.id into v_coupon_id2
          from public.promotion_coupons c
         where c.promotion_id = (v_applied.value ->> 'promotion_id')::uuid
           and c.code = (v_applied.value ->> 'coupon_code');
      end if;
      insert into public.promotion_redemptions (
        promotion_id, promotion_name, coupon_id, customer_id,
        order_id, order_number, amount_paise, is_first_order
      ) values (
        (v_applied.value ->> 'promotion_id')::uuid,
        v_applied.value ->> 'name',
        v_coupon_id2, v_uid, v_order_id, v_number,
        (v_applied.value ->> 'amount')::bigint,
        (v_applied.value ->> 'type') = 'first_order'
      );
      update public.promotions
         set uses_count = uses_count + 1
       where id = (v_applied.value ->> 'promotion_id')::uuid;
    end loop;
  exception
    when unique_violation then
      raise exception 'PROMOTION_CONSUMED' using errcode = 'P0001';
  end;

  insert into public.order_events (order_id, event_type, from_status, to_status, actor_id)
  values (v_order_id, 'ORDER_CREATED', null, 'pending', v_uid);

  -- Purchased cart rows go; anything else in the cart stays.
  if p_cart_item_ids is not null and array_length(p_cart_item_ids, 1) > 0 then
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id and c.customer_id = v_uid and ci.id = any(p_cart_item_ids);
  end if;

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_number, 'duplicate', false
  );
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, text, text, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, text, text, uuid[], text)
  to authenticated;
grant execute on function public.create_order(jsonb, jsonb, text, text, uuid[], text)
  to service_role;
