-- Bake n Take — Phase 4 refinement: recipient-owned notification deletes.
--
-- The bell panel supports per-item delete and "delete all read". Deletes are
-- scoped to the caller's own rows by RLS; inserts remain trigger-only.

-- Recipients may delete only their own notifications.
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

-- Privilege for the new operation (select/update already granted).
grant delete on table public.notifications to authenticated;
