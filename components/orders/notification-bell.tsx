"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { OverlayPortal } from "@/components/site/overlay-portal";
import {
  deleteNotificationAction,
  deleteReadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/orders/actions";
import type { Notification } from "@/lib/orders/types";

/**
 * Notification bell with realtime delivery (Phase 4).
 *
 * The bell is the entire notification UI — there is no standalone
 * notifications page. Initial state renders from the server; a single
 * user-scoped Realtime channel (`recipient_id = own id`, enforced by RLS)
 * prepends arrivals and bumps the badge. Clicking a notification marks it
 * read and routes to the exact resource (the caller's own order detail);
 * the destination pages re-verify ownership, so a forged id degrades to a
 * 404 instead of another customer's order.
 */
export function NotificationBell({
  userId,
  initialUnread,
  initialItems,
  orderBasePath,
}: {
  userId: string;
  initialUnread: number;
  initialItems: Notification[];
  /** Prefix for order detail links — plain string, safe to pass server→client. */
  orderBasePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Server snapshot at mount; realtime arrivals and optimistic action updates
  // keep it fresh afterwards, so no prop-syncing effect is needed.
  const [items, setItems] = useState<Notification[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  // The pathname the panel was opened on: toggling the bell flips it, any
  // navigation leaves it behind, and no listener is needed for either.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const [live, setLive] = useState(false);
  const seenIds = useRef(new Set(initialItems.map((item) => item.id)));

  // Exactly one user-scoped realtime subscription for the bell lifetime.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id : null;
          if (!id || seenIds.current.has(id)) return;
          seenIds.current.add(id);
          setItems((previous) =>
            [
              {
                id,
                type: typeof row.type === "string" ? row.type : "",
                title: typeof row.title === "string" ? row.title : "Update",
                message: typeof row.message === "string" ? row.message : "",
                entityType: typeof row.entity_type === "string" ? row.entity_type : null,
                entityId: typeof row.entity_id === "string" ? row.entity_id : null,
                isRead: false,
                createdAt: typeof row.created_at === "string" ? row.created_at : null,
              },
              ...previous,
            ].slice(0, 20),
          );
          setUnread((count) => count + 1);
          router.refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive(true);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  // Close on Escape — listener exists only while the panel is open.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function applyRead(id: string) {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    setUnread((count) => Math.max(0, count - 1));
  }

  function closePanel() {
    setOpenPath(null);
  }

  function togglePanel() {
    // Clicking the bell flips the panel; any navigation implicitly closes it
    // because `open` is derived from the pathname it was opened on.
    setOpenPath((previous) => (previous === pathname ? null : pathname));
  }
  /** Marks read, closes the panel, then routes to the exact order. */
  async function openNotification(item: Notification) {
    const target =
      item.entityType === "order" && item.entityId ? `${orderBasePath}/${item.entityId}` : null;
    if (!item.isRead) {
      await markNotificationReadAction(item.id);
      seenIds.current.add(item.id);
      applyRead(item.id);
    }
    closePanel();
    if (target) router.push(target);
    else router.refresh();
  }

  async function readAll() {
    await markAllNotificationsReadAction();
    setItems((previous) => previous.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
    router.refresh();
  }

  async function removeOne(item: Notification) {
    await deleteNotificationAction(item.id);
    seenIds.current.delete(item.id);
    setItems((previous) => previous.filter((entry) => entry.id !== item.id));
    if (!item.isRead) setUnread((count) => Math.max(0, count - 1));
    router.refresh();
  }

  async function removeRead() {
    await deleteReadNotificationsAction();
    setItems((previous) => previous.filter((item) => !item.isRead));
    router.refresh();
  }

  const hasRead = items.some((item) => item.isRead);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={togglePanel}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        title="Notifications"
        className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <span className="relative">
          <Bell aria-hidden="true" className="size-[1.05rem]" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <>
          {/*
            Portaled: like the mobile drawer, a `fixed` scrim here would be
            trapped by the header's backdrop-blur containing block and cover
            only the header. In the portal it covers the viewport, so
            outside-taps close the panel. The scrim is fully transparent —
            an interaction catcher only, never a visual veil: even a plain
            dim tint reads as a milky white-out over dark theme, so the
            panel floats as an isolated surface on its own shadow. The
            panel keeps its own contained frosted surface and stays
            anchored to the button via its positioned wrapper.
            Stacking: the catcher sits BELOW the sticky header (z-30) so
            the panel — which lives inside the header — stays clickable
            above it, while all page content stays beneath it.
          */}
          <OverlayPortal>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={closePanel}
              className="fixed inset-0 z-20 cursor-default bg-transparent"
            />
          </OverlayPortal>
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-20 mt-2 grid max-h-[calc(100dvh-5rem)] w-[min(20rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded-3xl border border-border/60 bg-card/95 p-2 shadow-[0_24px_48px_-24px_rgb(66_40_16/0.35)] backdrop-blur-xl dark:border-white/10 dark:shadow-none"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-sm font-medium">
                Notifications
                {!live ? (
                  <span className="font-normal text-muted-foreground"> · syncing</span>
                ) : null}
              </p>
              <div className="flex items-center gap-2">
                {hasRead ? (
                  <button
                    type="button"
                    onClick={() => void removeRead()}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Delete read
                  </button>
                ) : null}
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => void readAll()}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>
            </div>
            {items.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Nothing yet — order updates will appear here.
              </p>
            ) : (
              <ul className="grid max-h-80 gap-1 overflow-y-auto">
                {items.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-start gap-1 rounded-xl hover:bg-muted">
                    <button
                      type="button"
                      onClick={() => void openNotification(item)}
                      className="grid flex-1 gap-0.5 rounded-xl px-2 py-2 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        {!item.isRead ? (
                          <span aria-label="Unread" className="size-1.5 rounded-full bg-primary" />
                        ) : null}
                        {item.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.message}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeOne(item)}
                      aria-label={`Delete notification: ${item.title}`}
                      title="Delete notification"
                      className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {unread > 0 ? `${unread} unread notifications` : "No unread notifications"}
      </span>
    </div>
  );
}
