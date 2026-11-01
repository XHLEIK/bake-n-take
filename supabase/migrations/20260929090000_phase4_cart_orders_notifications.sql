-- =============================================================================
-- Bake n Take — Phase 4: cart, ordering, COD checkout, notifications
-- =============================================================================
-- One active cart per customer; orders with immutable snapshots; COD-style
-- payments as data (no gateway); explicit status machine; durable events;
-- persisted notifications fanned out by trigger (outbox pattern without a
-- worker: events commit in-transaction, the trigger writes notifications in
-- the same transaction, Realtime only delivers).
--
-- Money is integer paise everywhere. Client prices are never trusted: the
-- create_order function re-reads and re-prices everything from catalog rows
-- locked FOR UPDATE. No INSERT/UPDATE policies exist on orders, items,
-- payments, events or assets — writes happen only through SECURITY DEFINER
-- functions that enforce ownership and transitions internally.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Carts (one active cart per customer, ephemeral)
-- ---------------------------------------------------------------------------

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  flavour_id uuid references public.product_flavours (id) on delete set null,
  quantity integer not null default 1
    constraint cart_items_quantity_range check (quantity between 1 and 99),
  egg_eggless text
    constraint cart_items_egg_check check (egg_eggless is null or egg_eggless in ('egg', 'eggless')),
  message text
    constraint cart_items_message_length check (message is null or char_length(message) <= 60),
  design_path text
    constraint cart_items_design_length check (design_path is null or char_length(design_path) <= 500),
  product_name text not null default ''
    constraint cart_items_product_name_length check (char_length(product_name) <= 120),
  variant_label text,
  flavour_name text,
  unit_price_paise integer not null default 0
    constraint cart_items_unit_price_range check (unit_price_paise between 0 and 100000000),
  image_path text,
  created_at timestamptz not null default now()
);

create index if not exists cart_items_cart_idx on public.cart_items (cart_id, created_at);

drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at
  before update on public.carts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Orders (immutable once written; status moves only via transition_order)
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    constraint orders_number_format check (order_number ~ '^BNK-[0-9]{8}-[0-9]{4,}$'),
  customer_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending'
    constraint orders_status check (status in (
      'pending', 'confirmed', 'baking', 'ready_for_pickup', 'completed', 'cancelled'
    )),
  subtotal_paise integer not null default 0
    constraint orders_subtotal_range check (subtotal_paise between 0 and 1000000000),
  discount_paise integer not null default 0
    constraint orders_discount_range check (discount_paise between 0 and 1000000000),
  tax_paise integer not null default 0
    constraint orders_tax_range check (tax_paise between 0 and 1000000000),
  charges_paise integer not null default 0
    constraint orders_charges_range check (charges_paise between 0 and 1000000000),
  grand_total_paise integer not null default 0
    constraint orders_grand_range check (grand_total_paise between 0 and 1000000000),
  currency char(3) not null default 'INR'
    constraint orders_currency_format check (currency ~ '^[A-Z]{3}$'),
  contact_name text not null default ''
    constraint orders_contact_name_length check (char_length(contact_name) <= 80),
  contact_phone text not null default ''
    constraint orders_contact_phone_length check (char_length(contact_phone) <= 20),
  contact_email text not null default ''
    constraint orders_contact_email_length check (char_length(contact_email) <= 254),
  payment_method text not null default 'cod'
    constraint orders_payment_method check (payment_method in (
      'cod', 'pay_at_pickup', 'upi', 'card', 'razorpay'
    )),
  idempotency_key text not null unique
    constraint orders_idempotency_length check (char_length(idempotency_key) between 8 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Daily order-number sequence (locked per transaction: concurrency-safe).
create table if not exists public.order_counters (
  day date primary key,
  last_seq integer not null default 0
    constraint order_counters_seq_range check (last_seq between 0 and 999999)
);

create index if not exists orders_customer_idx
  on public.orders (customer_id, created_at desc);
create index if not exists orders_status_idx
  on public.orders (status, created_at desc);
create index if not exists orders_number_idx on public.orders (order_number);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Order items (snapshots — history survives catalog edits)
-- ---------------------------------------------------------------------------

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- RESTRICT protects history: a product with orders cannot be hard-deleted
  -- (archive it instead). Phase 4+ must keep this gate.
  product_id uuid references public.products (id) on delete restrict,
  product_name text not null default ''
    constraint order_items_name_length check (char_length(product_name) <= 120),
  product_slug text not null default '',
  variant_label text,
  variant_value text,
  flavour_name text,
  egg_eggless text
    constraint order_items_egg_check check (egg_eggless is null or egg_eggless in ('egg', 'eggless')),
  message text
    constraint order_items_message_length check (message is null or char_length(message) <= 60),
  design_path text,
  unit_price_paise integer not null default 0
    constraint order_items_unit_range check (unit_price_paise between 0 and 100000000),
  quantity integer not null default 1
    constraint order_items_quantity_range check (quantity between 1 and 99),
  line_total_paise integer not null default 0
    constraint order_items_line_range check (line_total_paise between 0 and 1000000000),
  image_path text,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 4. Payments (COD today, gateway-shaped for tomorrow)
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade unique,
  method text not null default 'cod'
    constraint payments_method check (method in (
      'cod', 'pay_at_pickup', 'upi', 'card', 'razorpay'
    )),
  status text not null default 'pending'
    constraint payments_status check (status in (
      'pending', 'processing', 'success', 'failed', 'refunded'
    )),
  amount_paise integer not null default 0
    constraint payments_amount_range check (amount_paise between 0 and 1000000000),
  currency char(3) not null default 'INR'
    constraint payments_currency_format check (currency ~ '^[A-Z]{3}$'),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Order events (audit trail + notification outbox source)
-- ---------------------------------------------------------------------------

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null
    constraint order_events_type check (event_type in (
      'ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_BAKING',
      'ORDER_READY', 'ORDER_COMPLETED', 'ORDER_CANCELLED'
    )),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_idx
  on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. Order assets (design drafts promoted to order attachments)
-- ---------------------------------------------------------------------------

create table if not exists public.order_assets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null default 'design'
    constraint order_assets_kind check (kind in ('design')),
  storage_path text not null
    constraint order_assets_path_length check (char_length(storage_path) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists order_assets_order_idx on public.order_assets (order_id);

-- ---------------------------------------------------------------------------
-- 7. Notifications (durable history; Realtime only delivers)
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null
    constraint notifications_type check (type in (
      'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_BAKING', 'ORDER_READY',
      'ORDER_COMPLETED', 'ORDER_CANCELLED', 'NEW_ORDER'
    )),
  title text not null default ''
    constraint notifications_title_length check (char_length(title) <= 120),
  message text not null default ''
    constraint notifications_message_length check (char_length(message) <= 500),
  entity_type text
    constraint notifications_entity check (entity_type is null or entity_type in ('order')),
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Row level security (restrictive: reads are scoped, writes go via RPC)
-- ---------------------------------------------------------------------------

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_events enable row level security;
alter table public.order_assets enable row level security;
alter table public.notifications enable row level security;

-- -- carts: the signed-in customer owns exactly their row.
drop policy if exists carts_owner on public.carts;
create policy carts_owner
  on public.carts for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

-- -- cart items: visible/editable only through the caller's own cart.
drop policy if exists cart_items_owner on public.cart_items;
create policy cart_items_owner
  on public.cart_items for all to authenticated
  using (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.customer_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.customer_id = (select auth.uid())
  ));

-- -- orders: customers read their own; owners read all. No direct writes:
-- creation and status changes happen only inside RPC functions.
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or public.is_owner());

-- -- order children: same visibility as the parent order.
drop policy if exists order_items_select on public.order_items;
create policy order_items_select
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.customer_id = (select auth.uid()) or public.is_owner())
  ));

drop policy if exists payments_select on public.payments;
create policy payments_select
  on public.payments for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and (o.customer_id = (select auth.uid()) or public.is_owner())
  ));

drop policy if exists order_events_select on public.order_events;
create policy order_events_select
  on public.order_events for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_events.order_id
      and (o.customer_id = (select auth.uid()) or public.is_owner())
  ));

drop policy if exists order_assets_select on public.order_assets;
create policy order_assets_select
  on public.order_assets for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_assets.order_id
      and (o.customer_id = (select auth.uid()) or public.is_owner())
  ));

-- -- notifications: recipients manage their own; nobody inserts/deletes.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.carts from anon, authenticated;
revoke all on table public.cart_items from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.order_events from anon, authenticated;
revoke all on table public.order_assets from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.order_counters from anon, authenticated;

grant select, insert, update, delete on table public.carts to authenticated;
grant select, insert, update, delete on table public.cart_items to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.order_events to authenticated;
grant select on table public.order_assets to authenticated;
grant select, update on table public.notifications to authenticated;

grant all on table public.carts to service_role;
grant all on table public.cart_items to service_role;
grant all on table public.orders to service_role;
grant all on table public.order_items to service_role;
grant all on table public.payments to service_role;
grant all on table public.order_events to service_role;
grant all on table public.order_assets to service_role;
grant all on table public.notifications to service_role;
grant all on table public.order_counters to service_role;

-- ---------------------------------------------------------------------------
-- 10. Realtime (delivery only — tables stay the source of truth)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_events'
  ) then
    alter publication supabase_realtime add table public.order_events;
  end if;
end
$$;

alter table public.notifications replica identity full;
alter table public.orders replica identity full;
alter table public.order_events replica identity full;

-- ---------------------------------------------------------------------------
-- 11. Order creation (single transaction: validate → price → write → event)
-- ---------------------------------------------------------------------------

create or replace function public.create_order(
  p_items jsonb,
  p_contact jsonb,
  p_payment_method text,
  p_idempotency_key text,
  p_cart_item_ids uuid[]
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
  end loop;

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
    payment_method, idempotency_key
  ) values (
    v_number, v_uid, 'pending',
    v_subtotal, 0, 0, 0, v_subtotal,
    v_currency,
    btrim(p_contact ->> 'name'), btrim(p_contact ->> 'phone'), lower(btrim(p_contact ->> 'email')),
    p_payment_method, nullif(btrim(p_idempotency_key), '')
  )
  returning id into v_order_id;

  -- Snapshot rows: what the customer ordered, immune to later catalog edits.
  -- Inputs were fully validated in the loop above, so casts here are safe.
  for v_item in
    select value from jsonb_array_elements(p_items) with ordinality order by ordinality
  loop
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

    insert into public.order_items (
      order_id, product_id, product_name, product_slug,
      variant_label, variant_value, flavour_name,
      egg_eggless, message, design_path,
      unit_price_paise, quantity, line_total_paise, image_path
    ) values (
      v_order_id, v_product_id, v_p_name, v_p_slug,
      v_var_label, v_var_value, v_fla_name,
      v_egg, v_message, v_design,
      v_unit, v_quantity,
      v_unit * v_quantity,
      v_img_path
    );

    if v_design is not null then
      insert into public.order_assets (order_id, kind, storage_path)
      values (v_order_id, 'design', v_design);
    end if;
  end loop;

  insert into public.payments (order_id, method, status, amount_paise, currency)
  values (v_order_id, p_payment_method, 'pending', v_subtotal, v_currency);

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

revoke all on function public.create_order(jsonb, jsonb, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, text, text, uuid[]) to authenticated;
grant execute on function public.create_order(jsonb, jsonb, text, text, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- 12. Status transitions (the state machine — single enforcement point)
-- ---------------------------------------------------------------------------

create or replace function public.transition_order(p_order_id uuid, p_to_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order record;
  v_owner boolean := public.is_owner();
  v_allowed boolean := false;
  v_from_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select o.* into v_order
    from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Customers see only their own orders; owners see all. Missing/foreign
  -- orders collapse to ORDER_NOT_FOUND so ids cannot be probed.
  v_from_status := v_order.status;
  if not v_owner and v_order.customer_id is distinct from v_uid then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Explicit transition map. Customers may only cancel their own pending order.
  if v_order.status = 'pending' and p_to_status in ('confirmed', 'cancelled') then
    v_allowed := v_owner or p_to_status = 'cancelled';
  elsif v_order.status = 'confirmed' and p_to_status in ('baking', 'cancelled') then
    v_allowed := v_owner;
  elsif v_order.status = 'baking' and p_to_status in ('ready_for_pickup', 'cancelled') then
    v_allowed := v_owner;
  elsif v_order.status = 'ready_for_pickup' and p_to_status in ('completed', 'cancelled') then
    v_allowed := v_owner;
  end if;

  if not v_allowed then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  update public.orders set status = p_to_status where id = p_order_id;

  insert into public.order_events (order_id, event_type, from_status, to_status, actor_id)
  values (
    p_order_id,
    case p_to_status
      when 'confirmed' then 'ORDER_CONFIRMED'
      when 'baking' then 'ORDER_BAKING'
      when 'ready_for_pickup' then 'ORDER_READY'
      when 'completed' then 'ORDER_COMPLETED'
      when 'cancelled' then 'ORDER_CANCELLED'
    end,
    v_from_status, p_to_status, v_uid
  );

  return jsonb_build_object('order_id', p_order_id, 'status', p_to_status);
end;
$$;

revoke all on function public.transition_order(uuid, text) from public, anon, authenticated;
grant execute on function public.transition_order(uuid, text) to authenticated;
grant execute on function public.transition_order(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 13. Notification fan-out (trigger = the outbox processor, in-transaction)
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_oid uuid;
  v_customer_id uuid;
  v_order_number text;
  v_notif_type text;
  v_owner_id uuid;
  v_store_name text;
  v_customer_title text;
  v_customer_message text;
begin
  select o.* into v_order from public.orders o where o.id = new.order_id;
  if not found then
    return new;
  end if;
  v_oid := v_order.id;
  v_customer_id := v_order.customer_id;
  v_order_number := v_order.order_number;

  select coalesce(s.store_name, 'our bakery') into v_store_name
    from public.store_settings s where s.id = 1;

  case new.event_type
    when 'ORDER_CREATED' then
      v_notif_type := 'ORDER_PLACED';
      v_customer_title := 'Order placed';
      v_customer_message := 'Order #' || v_order_number || ' has been placed successfully.';
    when 'ORDER_CONFIRMED' then
      v_notif_type := 'ORDER_CONFIRMED';
      v_customer_title := 'Order confirmed';
      v_customer_message := 'Order #' || v_order_number || ' has been confirmed.';
    when 'ORDER_BAKING' then
      v_notif_type := 'ORDER_BAKING';
      v_customer_title := 'Baking started';
      v_customer_message := 'Order #' || v_order_number || ' is now being prepared.';
    when 'ORDER_READY' then
      v_notif_type := 'ORDER_READY';
      v_customer_title := 'Ready for pickup';
      v_customer_message := 'Order #' || v_order_number || ' is ready for pickup.';
    when 'ORDER_COMPLETED' then
      v_notif_type := 'ORDER_COMPLETED';
      v_customer_title := 'Order completed';
      v_customer_message := 'Order #' || v_order_number
        || ' has been completed. Thank you for ordering from ' || v_store_name || '!';
    when 'ORDER_CANCELLED' then
      v_notif_type := 'ORDER_CANCELLED';
      v_customer_title := 'Order cancelled';
      v_customer_message := 'Order #' || v_order_number || ' has been cancelled.';
    else
      return new;
  end case;

  if v_customer_id is not null then
    insert into public.notifications
      (recipient_id, type, title, message, entity_type, entity_id)
    values
      (v_customer_id, v_notif_type, v_customer_title, v_customer_message, 'order', v_oid);
  end if;

  if new.event_type = 'ORDER_CREATED' then
    for v_owner_id in
      select p.id from public.profiles p where p.role = 'OWNER' and p.status = 'ACTIVE'
    loop
      insert into public.notifications
        (recipient_id, type, title, message, entity_type, entity_id)
      values
        (v_owner_id, 'NEW_ORDER', 'New order received',
         'New order #' || v_order_number || ' received.', 'order', v_oid);
    end loop;
  elsif new.event_type = 'ORDER_CANCELLED' and new.actor_id is distinct from v_customer_id then
    -- A customer cancelling their own order still pings the owners.
    for v_owner_id in
      select p.id from public.profiles p where p.role = 'OWNER' and p.status = 'ACTIVE'
    loop
      insert into public.notifications
        (recipient_id, type, title, message, entity_type, entity_id)
      values
        (v_owner_id, 'ORDER_CANCELLED', 'Order cancelled',
         'Order #' || v_order_number || ' was cancelled.', 'order', v_oid);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists order_events_notify on public.order_events;
create trigger order_events_notify
  after insert on public.order_events
  for each row
  execute function public.notify_on_order_event();

-- ---------------------------------------------------------------------------
-- 14. Post-migration verification (run manually)
-- ---------------------------------------------------------------------------
-- select tablename from pg_tables where schemaname = 'public'
--   and tablename in ('carts','cart_items','orders','order_items','payments',
--     'order_events','order_assets','notifications','order_counters');
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and proname in ('create_order','transition_order','notify_on_order_event');
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'orders';
