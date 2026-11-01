-- Bake n Take — Phase 4 refinement: paid completion + completed-order deletion.
--
-- 1. Completing an order now requires the owner to confirm payment was
--    received (cash/UPI at pickup). The transition marks the payment row
--    `success` in the same transaction, so completed orders never display
--    "pending" again, and the completion notification says payment is in.
-- 2. Owners and owning customers may delete completed orders. The order row
--    cascades to items/payments/events/assets; linked notifications are
--    removed explicitly (entity_id carries no FK).

-- ---------------------------------------------------------------------------
-- 1. transition_order with payment confirmation
-- ---------------------------------------------------------------------------

-- Drop the 2-arg signature first: keeping both overloads would make
-- PostgREST calls ambiguous.
drop function if exists public.transition_order(uuid, text);

create or replace function public.transition_order(
  p_order_id uuid,
  p_to_status text,
  p_payment_received boolean default false
)
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

  -- Pickup payment is collected with the handover: completion is blocked
  -- until the owner confirms it, and the confirmation flips the payment
  -- row in the same transaction as the status change.
  if p_to_status = 'completed' then
    if not coalesce(p_payment_received, false) then
      raise exception 'PAYMENT_REQUIRED' using errcode = 'P0001';
    end if;
    update public.payments set status = 'success' where order_id = p_order_id;
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

revoke all on function public.transition_order(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.transition_order(uuid, text, boolean) to authenticated;
grant execute on function public.transition_order(uuid, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Paid wording on the completion notification
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
        || ' has been completed — payment received. Thank you for ordering from '
        || v_store_name || '!';
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

-- ---------------------------------------------------------------------------
-- 3. Completed-order deletion (owners + owning customers)
-- ---------------------------------------------------------------------------

create or replace function public.delete_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order record;
  v_owner boolean := public.is_owner();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select o.* into v_order
    from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Same visibility rule as reads: owners see all, customers only their own.
  -- Foreign ids collapse to ORDER_NOT_FOUND so ids cannot be probed.
  if not v_owner and v_order.customer_id is distinct from v_uid then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Only finished history may be deleted — active orders stay protected.
  if v_order.status is distinct from 'completed' then
    raise exception 'ORDER_NOT_DELETABLE' using errcode = 'P0001';
  end if;

  -- Linked notifications carry no FK, so they go explicitly. Items,
  -- payments, events and assets cascade from the order row itself.
  delete from public.notifications
   where entity_type = 'order' and entity_id = p_order_id;

  delete from public.orders where id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'deleted', true);
end;
$$;

revoke all on function public.delete_order(uuid) from public, anon, authenticated;
grant execute on function public.delete_order(uuid) to authenticated;
grant execute on function public.delete_order(uuid) to service_role;
