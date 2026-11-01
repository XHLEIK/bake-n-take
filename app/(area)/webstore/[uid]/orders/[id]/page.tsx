import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { InlineMessage } from "@/components/auth/inline-message";
import { CancelOrderButton, DeleteOrderButton } from "@/components/orders/order-actions";
import { OrderStatusBadge, OrderTimeline } from "@/components/orders/order-display";
import { formatPickupAt } from "@/lib/orders/pickup";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { redirectIfUidMismatch, requireUser } from "@/lib/auth/session";
import { getOrderBundle, signedDesignUrl } from "@/lib/orders/repository";
import { formatPaise } from "@/lib/store/format";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Order details" };

type DetailParams = Promise<{ uid: string; id: string }>;
type DetailSearch = Promise<Record<string, string | string[] | undefined>>;

/**
 * Customer order detail.
 *
 * `?fresh=1` renders the confirmation hero right after placement; otherwise
 * the standard tracking page: status, live timeline, snapshot items, totals,
 * payment and design previews. Cancel appears only while pending; delete
 * only when completed — both enforced server-side as before.
 */
export default async function CustomerOrderDetailPage({
  params,
  searchParams,
}: {
  params: DetailParams;
  searchParams: DetailSearch;
}) {
  const { uid, id } = await params;
  const query = await searchParams;
  const error = searchParamErrorCode(query);
  const fresh = query.fresh === "1" || (Array.isArray(query.fresh) && query.fresh[0] === "1");
  const session = await requireUser(`/webstore/${uid}/orders/${id}`);

  redirectIfUidMismatch(session, uid);

  const webstore = `/webstore/${uid}`;
  const [bundle, settings] = await Promise.all([getOrderBundle(id), getStoreSettings()]);
  if (!bundle || bundle.customerId !== session.user.id) notFound();

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
      {error ? <InlineMessage variant="error" message={authErrorMessage(error)} /> : null}

      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Link
          href={`${webstore}/orders`}
          className="rounded-sm hover:text-foreground hover:underline"
        >
          My orders
        </Link>
        <span aria-hidden="true" className="text-border">
          /
        </span>
        <span aria-current="page" className="text-foreground">
          #{bundle.orderNumber}
        </span>
      </nav>

      {fresh ? (
        <section
          aria-label="Order confirmed"
          className="relative grid gap-2 overflow-hidden rounded-[2rem] border border-sage/30 bg-sage/[0.08] p-7 text-center sm:p-10"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 left-1/2 size-64 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--sage)_18%,transparent),transparent)]"
          />
          <CheckCircle2 aria-hidden="true" className="relative mx-auto size-10 text-sage" />
          <h1 className="relative font-serif text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
            Order placed!
          </h1>
          <p className="relative text-sm text-muted-foreground">
            Order <strong className="text-foreground">#{bundle.orderNumber}</strong> ·{" "}
            {formatPaise(bundle.grandTotalPaise, money)} ·{" "}
            {bundle.paymentMethod === "pay_at_pickup" ? "Pay at Pickup" : "Cash on Pickup"}
          </p>
          <p className="relative text-xs text-muted-foreground">
            We will confirm it shortly — watch this page for live updates.
          </p>
          <p className="relative mt-2 flex justify-center gap-5 text-sm">
            <Link href={`${webstore}/orders`} className="font-medium text-primary hover:underline">
              My orders
            </Link>
            <Link href={`${webstore}/shop`} className="font-medium text-primary hover:underline">
              Keep browsing
            </Link>
          </p>
        </section>
      ) : (
        <div className="grid gap-2">
          <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-primary/90 uppercase">
            Order #{bundle.orderNumber}
          </p>
          <h1 className="font-serif text-[2.25rem] leading-[1.08] font-medium tracking-[-0.015em]">
            {formatPaise(bundle.grandTotalPaise, money)}
          </h1>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
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
        {formatPickupAt(bundle.pickupAt) ? (
          <span className="text-xs font-medium text-primary">
            Pickup: {formatPickupAt(bundle.pickupAt)}
          </span>
        ) : null}
      </div>

      <section
        aria-label="Timeline"
        className="rounded-[2rem] border border-border/60 bg-card/70 p-5 sm:p-6"
      >
        <OrderTimeline status={bundle.status} />
      </section>

      <section aria-label="Items" className="grid gap-3">
        {bundle.items.map((item) => (
          <div
            key={item.id}
            className="grid gap-1.5 rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5 text-sm"
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
              <p className="text-xs text-muted-foreground">
                Custom design attached
                {designUrls.get(item.id) ? (
                  <>
                    {" · "}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={designUrls.get(item.id) as string}
                      alt="Your design for this item"
                      className="mt-1 max-h-32 rounded-xl object-contain"
                    />
                  </>
                ) : null}
              </p>
            ) : null}
            <p className="text-right font-semibold tabular-nums">
              {formatPaise(item.lineTotalPaise, money)}
            </p>
            {item.lineDiscountPaise > 0 ? (
              <p className="text-right text-xs font-medium text-sage">
                −{formatPaise(item.lineDiscountPaise, money)} with offer
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section
        aria-label="Order summary"
        className="grid gap-2 rounded-[2rem] border border-border/60 bg-card/80 p-5 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_24px_48px_-36px_rgb(66_40_16/0.4)] sm:p-6 dark:border-white/10 dark:shadow-none"
      >
        <dl className="grid gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatPaise(bundle.subtotalPaise, money)}</dd>
          </div>
          {bundle.discountBreakdown.map((offer) => (
            <div key={offer.promotionId} className="flex justify-between">
              <dt className="text-sage">
                {offer.name}
                {offer.couponCode ? ` · ${offer.couponCode}` : ""}
              </dt>
              <dd className="font-medium text-sage tabular-nums">
                −{formatPaise(offer.amountPaise, money)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="tabular-nums">{formatPaise(bundle.discountPaise, money)}</dd>
          </div>
          <div className="flex justify-between border-t border-border/70 pt-2.5 text-base font-semibold">
            <dt>
              {bundle.payment?.status === "success"
                ? "Total paid"
                : bundle.paymentMethod === "pay_at_pickup"
                  ? "Total to pay at pickup"
                  : "Total on pickup"}
            </dt>
            <dd className="font-heading tabular-nums">
              {formatPaise(bundle.grandTotalPaise, money)}
            </dd>
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
        aria-label="Contact snapshot"
        className="grid gap-1 rounded-[2rem] border border-border/60 bg-card/60 p-5 text-sm sm:p-6"
      >
        <h2 className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Pickup contact
        </h2>
        <p className="mt-1 font-medium">{bundle.contactName}</p>
        <p className="text-muted-foreground">{bundle.contactPhone}</p>
        <p className="text-muted-foreground">{bundle.contactEmail}</p>
      </section>

      {bundle.status === "pending" ? <CancelOrderButton orderId={bundle.id} /> : null}
      {bundle.status === "completed" ? (
        <DeleteOrderButton orderId={bundle.id} returnTo={`${webstore}/orders`} />
      ) : null}
    </main>
  );
}
