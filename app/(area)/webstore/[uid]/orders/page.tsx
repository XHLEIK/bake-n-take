import type { Metadata } from "next";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/orders/order-display";
import { redirectIfUidMismatch, requireUser } from "@/lib/auth/session";
import { listCustomerOrders } from "@/lib/orders/repository";
import { formatPaise } from "@/lib/store/format";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "My orders" };

type OrdersParams = Promise<{ uid: string }>;

/**
 * Customer order history.
 *
 * Immutable snapshots presented as warm, scannable cards: order number in
 * serif, live status badge, total. Same data, same links, calmer surface.
 */
export default async function CustomerOrdersPage({ params }: { params: OrdersParams }) {
  const { uid } = await params;
  const session = await requireUser(`/webstore/${uid}/orders`);

  redirectIfUidMismatch(session, uid);

  const webstore = `/webstore/${uid}`;
  const [orders, settings] = await Promise.all([
    listCustomerOrders(session.user.id),
    getStoreSettings(),
  ]);
  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-3">
        <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-primary/90 uppercase">
          Your orders
        </p>
        <h1 className="font-serif text-[2.25rem] leading-[1.08] font-medium tracking-[-0.015em] sm:text-5xl">
          My orders
        </h1>
      </div>

      {orders.length === 0 ? (
        <div className="grid gap-3 rounded-[2rem] border border-dashed border-border px-6 py-16 text-center">
          <p className="font-serif text-2xl font-medium">No orders yet.</p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            When you place your first order, its live status will appear here from the oven to your
            pocket.
          </p>
          <Link
            href={`${webstore}/shop`}
            className="brand-surface mx-auto mt-2 inline-flex h-12 items-center rounded-2xl px-6 text-sm font-semibold text-primary-foreground"
          >
            Browse the bake list
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3.5">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`${webstore}/orders/${order.id}`}
                className="group flex items-center justify-between gap-4 rounded-3xl border border-border/60 bg-card/60 px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-[0_18px_36px_-28px_rgb(66_40_16/0.4)] dark:border-white/10 dark:hover:shadow-none"
              >
                <span className="grid gap-1">
                  <span className="font-serif text-lg font-medium tracking-tight">
                    #{order.orderNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}{" "}
                    · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="grid justify-items-end gap-1.5">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-sm font-semibold tabular-nums">
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
