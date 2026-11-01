import type { Metadata } from "next";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/orders/order-display";
import { requireOwner } from "@/lib/auth/session";
import { listOwnerOrders, type OwnerOrderFilters } from "@/lib/orders/repository";
import { ORDER_STATUSES } from "@/lib/orders/machine";
import { formatPaise } from "@/lib/store/format";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Orders" };

type Search = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Owner orders dashboard (Phase 4).
 *
 * Search by number/customer, status/date filters, newest/oldest sort.
 * Availability toggles and archive actions from the catalog console are
 * intentionally absent here — this page is about fulfillment, with realtime
 * arrivals via the header bell plus a manual refresh.
 */
export default async function OwnerOrdersPage({ searchParams }: { searchParams: Search }) {
  await requireOwner("/owner/orders");
  const params = await searchParams;

  const filters: OwnerOrderFilters = {
    search: first(params.q) || undefined,
    status: first(params.status) || undefined,
    date: first(params.date) || undefined,
    sort: first(params.sort) === "oldest" ? "oldest" : "newest",
  };

  const [orders, settings] = await Promise.all([listOwnerOrders(filters), getStoreSettings()]);
  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Owner console
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} order{orders.length === 1 ? "" : "s"} · newest first unless sorted
          otherwise
        </p>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="grid gap-1.5 text-xs font-medium">
          Search
          <input
            name="q"
            defaultValue={filters.search ?? ""}
            placeholder="Number or customer…"
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
          >
            <option value="">All</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Date
          <input
            type="date"
            name="date"
            defaultValue={filters.date ?? ""}
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Sort
          <select
            name="sort"
            defaultValue={filters.sort ?? "newest"}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-10 w-full rounded-xl bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Apply
          </button>
        </div>
      </form>

      {orders.length === 0 ? (
        <div className="grid gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <p className="font-medium">No orders match.</p>
          <p className="text-sm text-muted-foreground">
            New orders arrive here in real time — keep this page open during bake hours.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/owner/orders/${order.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 px-4 py-3.5 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="grid gap-1">
                  <span className="font-medium">#{order.orderNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {order.customerName || "Customer"} ·{" "}
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : ""}{" "}
                    · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-sm font-semibold">
                    {formatPaise(order.grandTotalPaise, money)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
