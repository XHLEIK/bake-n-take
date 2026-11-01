-- ---------------------------------------------------------------------------
-- Phase 8: pickup scheduling.
--
-- * products.min_prep_minutes: owner-configured minimum lead time in whole
--   minutes (0 = ready now, default 720 = 12 hours). Existing rows inherit
--   the default — no order flow changes for them beyond the new rule.
-- * cart_items.pickup_at / orders.pickup_at: UTC instants (timestamptz).
--   Null marks pre-feature rows; new writes always set them.
-- * create_order keeps its 6-argument signature (no grant changes): per-line
--   pickup instants arrive inside p_items, each line is validated against
--   its locked product row (requested >= now() + min_prep_minutes), and the
--   order stores the latest line pickup. Owner completion timing is
--   untouched — the minimum only gates what customers may request.
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists min_prep_minutes integer not null default 720
    constraint products_min_prep_range check (min_prep_minutes between 0 and 43200);

comment on column public.products.min_prep_minutes is
  'Minimum preparation lead time in minutes before a customer may request pickup.';

alter table public.cart_items
  add column if not exists pickup_at timestamptz;

comment on column public.cart_items.pickup_at is
  'Customer-requested pickup instant (UTC) chosen on the product page; null on pre-feature rows.';

alter table public.orders
  add column if not exists pickup_at timestamptz;

comment on column public.orders.pickup_at is
  'Requested pickup instant (UTC): the latest per-line pickup across the order. Null on pre-feature orders.';

-- ---------------------------------------------------------------------------
-- Order creation with per-line pickup validation (replaces the Phase 5 body;
-- same signature, so existing grants stand).
-- ---------------------------------------------------------------------------

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
  v_p_prep integer;
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
  v_pickup timestamptz;
  v_pickup_max timestamptz;
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
      p.message_enabled, p.allow_custom_design, p.min_prep_minutes
      into
      v_p_name, v_p_base,
      v_p_egg_en, v_p_egg_sur,
      v_p_msg_en, v_p_design_en, v_p_prep
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

    -- Per-line pickup, validated against this line's locked product row.
    -- Missing, malformed or stale instants fail closed; the minimum is
    -- recomputed here from now(), never trusted from the client. The order
    -- keeps the latest line pickup (one collection moment).
    v_pickup := null;
    if coalesce(v_item.value ->> 'pickup_at', '') <> '' then
      begin
        v_pickup := (v_item.value ->> 'pickup_at')::timestamptz;
      exception when others then
        v_pickup := null;
      end;
    end if;
    if v_pickup is null then
      raise exception 'INVALID_PICKUP' using errcode = 'P0001';
    end if;
    if v_pickup < now() + coalesce(v_p_prep, 720) * interval '1 minute' then
      raise exception 'PICKUP_TOO_EARLY' using errcode = 'P0001';
    end if;
    if v_pickup_max is null or v_pickup > v_pickup_max then
      v_pickup_max := v_pickup;
    end if;
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
    payment_method, idempotency_key, promo_breakdown, coupon_code, pickup_at
  ) values (
    v_number, v_uid, 'pending',
    v_subtotal, v_discount, 0, 0, v_grand,
    v_currency,
    btrim(p_contact ->> 'name'), btrim(p_contact ->> 'phone'), lower(btrim(p_contact ->> 'email')),
    p_payment_method, nullif(btrim(p_idempotency_key), ''), v_breakdown, v_coupon_norm,
    v_pickup_max
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
