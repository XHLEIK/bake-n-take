import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineMessage } from "@/components/auth/inline-message";
import { OrderStatusBadge, OrderTimeline } from "@/components/orders/order-display";
import { DeleteOrderButton } from "@/components/orders/order-actions";
import { OrderTransitionButtons } from "@/components/orders/order-transition-buttons";
import { requireOwner } from "@/lib/auth/session";
import { getOrderBundle, signedDesignUrl } from "@/lib/orders/repository";
import { formatPickupAt } from "@/lib/orders/pickup";
import { formatPaise } from "@/lib/store/format";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Order" };

type DetailParams = Promise<{ id: string }>;

/**
 * Owner order detail (Phase 4).
 *
 * Customer snapshot, items, totals, payment, timeline, and the legal status
 * buttons for the current state. Custom designs render through short-lived
 * signed URLs — the private bucket is never linked directly.
 */
export default async function OwnerOrderDetailPage({ params }: { params: DetailParams }) {
  const { id } = await params;
  await requireOwner(`/owner/orders/${id}`);

  const [bundle, settings] = await Promise.all([getOrderBundle(id, "owner"), getStoreSettings()]);
  if (!bundle) notFound();

  const money = {
    currency: bundle.currency ?? settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };
  const designs = await Promise.all(
    bundle.items
      .filter((item) => item.designPath)
      .map(async (item) => ({ itemId: item.id, url: await signedDesignUrl(item.designPath) })),
  );
  const designUrls = new Map(designs.map((entry) => [entry.itemId, entry.url]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/owner/orders" className="hover:underline">
          Orders
        </Link>
        {" · "}
        <span aria-current="page" className="text-foreground">
          #{bundle.orderNumber}
        </span>
      </nav>

      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Order #{bundle.orderNumber}
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {formatPaise(bundle.grandTotalPaise, money)}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={bundle.status} />
          <span className="text-xs text-muted-foreground">
            Placed{" "}
            {bundle.createdAt
              ? new Date(bundle.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : ""}
          </span>
        </div>
      </div>

      {formatPickupAt(bundle.pickupAt) ? (
        <section
          aria-label="Pickup"
          className="grid gap-1 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 sm:p-5"
        >
          <h2 className="font-heading text-base font-semibold tracking-wide text-primary uppercase">
            Pickup
          </h2>
          <p className="text-lg font-semibold">{formatPickupAt(bundle.pickupAt)}</p>
          <p className="text-xs text-muted-foreground">
            Requested collection time — fulfilling early is always allowed.
          </p>
        </section>
      ) : null}

      <section
        aria-label="Customer"
        className="grid gap-1 rounded-2xl border border-border bg-card/60 p-4 text-sm sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">Customer</h2>
        <p>{bundle.contactName}</p>
        <p className="text-muted-foreground">{bundle.contactPhone}</p>
        <p className="text-muted-foreground">{bundle.contactEmail}</p>
      </section>

      <section aria-label="Items" className="grid gap-3">
        {bundle.items.map((item) => (
          <div
            key={item.id}
            className="grid gap-1 rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm"
          >
            <p className="font-medium">
              {item.productName} × {item.quantity}
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                item.variantLabel,
                item.flavourName,
                item.eggEggless === "eggless"
                  ? "Eggless"
                  : item.eggEggless === "egg"
                    ? "Egg"
                    : null,
                item.message ? `“${item.message}”` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Standard"}
            </p>
            {item.designPath ? (
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Customer design attached</p>
                {designUrls.get(item.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={designUrls.get(item.id) as string}
                    alt={`Design for ${item.productName}`}
                    className="max-h-48 rounded-xl object-contain"
                  />
                ) : (
                  <InlineMessage variant="error" message="The design file could not be loaded." />
                )}
              </div>
            ) : null}
            <p className="text-right font-semibold">{formatPaise(item.lineTotalPaise, money)}</p>
            {item.lineDiscountPaise > 0 ? (
              <p className="text-right text-xs font-medium text-emerald-600">
                −{formatPaise(item.lineDiscountPaise, money)} with offer
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section
        aria-label="Order summary"
        className="grid gap-2 rounded-2xl border border-border bg-card/70 p-4 sm:p-5"
      >
        <dl className="grid gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatPaise(bundle.subtotalPaise, money)}</dd>
          </div>
          {bundle.discountBreakdown.map((offer) => (
            <div key={offer.promotionId} className="flex justify-between">
              <dt className="text-emerald-600">
                {offer.name}
                {offer.couponCode ? ` · ${offer.couponCode}` : ""}
              </dt>
              <dd className="font-medium text-emerald-600">
                −{formatPaise(offer.amountPaise, money)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Discount</dt>
            <dd>{formatPaise(bundle.discountPaise, money)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatPaise(bundle.grandTotalPaise, money)}</dd>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>Payment</dt>
            <dd>
              {bundle.paymentMethod === "pay_at_pickup" ? "Pay at Pickup" : "Cash on Pickup"} ·{" "}
              {bundle.payment?.status === "success"
                ? "Paid"
                : (bundle.payment?.status ?? "pending")}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-label="Timeline"
        className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="pb-3 font-heading text-base font-semibold">Timeline</h2>
        <OrderTimeline status={bundle.status} />
        <ul className="mt-2 grid gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {bundle.events.map((event) => (
            <li key={event.id}>
              {event.createdAt
                ? new Date(event.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : ""}{" "}
              — {event.eventType.replace(/_/g, " ").toLowerCase()}
            </li>
          ))}
        </ul>
      </section>

      <OrderTransitionButtons orderId={bundle.id} status={bundle.status} />
      {bundle.status === "completed" ? (
        <DeleteOrderButton orderId={bundle.id} returnTo="/owner/orders" />
      ) : null}
    </main>
  );
}
