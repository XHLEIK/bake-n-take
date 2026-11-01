-- Bake n Take — Phase 4 refinement: per-side order deletion.
--
-- Deleting a completed order now hides it only from the deleter's side:
-- customers set customer_deleted_at, owners set owner_deleted_at. Reads
-- (RLS + repository) filter each side's flag, so a customer delete leaves
-- the owner's console untouched and vice versa. The row — and its
-- notifications — is physically removed only once BOTH sides have deleted
-- it, at which point nobody can see it anymore.

-- ---------------------------------------------------------------------------
-- 1. Per-side deletion flags
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists customer_deleted_at timestamptz,
  add column if not exists owner_deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Reads hide each side's own deletions (defense in depth; the app
--    repository filters the same way)
-- ---------------------------------------------------------------------------

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
  on public.orders for select to authenticated
  using (
    (customer_id = (select auth.uid()) and customer_deleted_at is null)
    or (public.is_owner() and owner_deleted_at is null)
  );

drop policy if exists order_items_select on public.order_items;
create policy order_items_select
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (
        (o.customer_id = (select auth.uid()) and o.customer_deleted_at is null)
        or (public.is_owner() and o.owner_deleted_at is null)
      )
  ));

drop policy if exists payments_select on public.payments;
create policy payments_select
  on public.payments for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and (
        (o.customer_id = (select auth.uid()) and o.customer_deleted_at is null)
        or (public.is_owner() and o.owner_deleted_at is null)
      )
  ));

drop policy if exists order_events_select on public.order_events;
create policy order_events_select
  on public.order_events for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_events.order_id
      and (
        (o.customer_id = (select auth.uid()) and o.customer_deleted_at is null)
        or (public.is_owner() and o.owner_deleted_at is null)
      )
  ));

drop policy if exists order_assets_select on public.order_assets;
create policy order_assets_select
  on public.order_assets for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_assets.order_id
      and (
        (o.customer_id = (select auth.uid()) and o.customer_deleted_at is null)
        or (public.is_owner() and o.owner_deleted_at is null)
      )
  ));

-- ---------------------------------------------------------------------------
-- 3. Per-side delete_order (owners + owning customers, completed only)
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

  -- Only the caller's own notifications go; the other side keeps theirs.
  delete from public.notifications
   where entity_type = 'order'
     and entity_id = p_order_id
     and recipient_id = v_uid;

  if v_owner then
    if v_order.customer_deleted_at is not null then
      -- Both sides are done: physically remove the row (items, payments,
      -- events and assets cascade) and any leftover notifications.
      delete from public.notifications
       where entity_type = 'order' and entity_id = p_order_id;
      delete from public.orders where id = p_order_id;
    else
      update public.orders set owner_deleted_at = now() where id = p_order_id;
    end if;
  else
    if v_order.owner_deleted_at is not null then
      delete from public.notifications
       where entity_type = 'order' and entity_id = p_order_id;
      delete from public.orders where id = p_order_id;
    else
      update public.orders set customer_deleted_at = now() where id = p_order_id;
    end if;
  end if;

  return jsonb_build_object('order_id', p_order_id, 'deleted', true);
end;
$$;

revoke all on function public.delete_order(uuid) from public, anon, authenticated;
grant execute on function public.delete_order(uuid) to authenticated;
grant execute on function public.delete_order(uuid) to service_role;
