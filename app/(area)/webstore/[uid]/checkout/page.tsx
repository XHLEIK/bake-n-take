import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/orders/checkout-form";
import { CouponForm } from "@/components/offers/coupon-form";
import { InlineMessage } from "@/components/auth/inline-message";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { redirectIfUidMismatch, requireUser } from "@/lib/auth/session";
import { getCart } from "@/lib/orders/repository";
import { formatPickupAt } from "@/lib/orders/pickup";
import { getCartQuote } from "@/lib/promotions/quote";
import { formatPaise } from "@/lib/store/format";
import { formatAddress, getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Checkout" };

type CheckoutParams = Promise<{ uid: string }>;
type CheckoutSearch = Promise<Record<string, string | string[] | undefined>>;

/**
 * Customer checkout.
 *
 * Single review page, same engine underneath: lines re-read from the
 * customer's own cart rows, contact prefilled but stored per-order,
 * server-computed totals preview, idempotent placement. The presentation
 * splits review (lines + coupon) from the form's contact/payment/pickup
 * sections so the page reads calmly top to bottom.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: CheckoutParams;
  searchParams: CheckoutSearch;
}) {
  const { uid } = await params;
  const query = await searchParams;
  const error = searchParamErrorCode(query);
  const session = await requireUser(`/webstore/${uid}/checkout`);

  redirectIfUidMismatch(session, uid);

  const webstore = `/webstore/${uid}`;
  const requested = query.items;
  const wantedIds = (Array.isArray(requested) ? requested : requested ? [requested] : []).filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );

  const [cart, settings, profile] = await Promise.all([
    getCart(session.user.id),
    getStoreSettings(),
    Promise.resolve(session.profile),
  ]);

  const lines = (cart?.items ?? []).filter(
    (item) => wantedIds.length === 0 || wantedIds.includes(item.id),
  );
  if (lines.length === 0) redirect(`${webstore}/cart`);

  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };
  const subtotalPaise = lines.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  const orderable = lines.every((item) => item.valid);
  // One collection moment: the latest requested pickup across all lines.
  const orderPickupAt = formatPickupAt(
    lines
      .map((item) => (item.pickupAt ? Date.parse(item.pickupAt) : NaN))
      .filter((ms) => Number.isFinite(ms))
      .sort((a, b) => a - b)
      .map((ms) => new Date(ms).toISOString())
      .at(-1) ?? null,
  );
  const address = settings ? formatAddress(settings) : null;
  // Authoritative preview: same engine the order transaction runs. The final
  // numbers are recomputed at placement — this display never decides them.
  const { quote, couponCode } = await getCartQuote(
    session.user.id,
    lines.map((item) => item.id),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      {error ? <InlineMessage variant="error" message={authErrorMessage(error)} /> : null}

      <div className="grid gap-3">
        <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-primary/90 uppercase">
          Almost there
        </p>
        <h1 className="font-serif text-[2.25rem] leading-[1.08] font-medium tracking-[-0.015em] sm:text-5xl">
          Review your order
        </h1>
      </div>

      <section aria-label="Order lines" className="grid gap-3">
        {lines.map((item) => (
          <div
            key={item.id}
            className="flex items-baseline justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5 text-sm"
          >
            <span className="grid gap-0.5">
              <span className="font-medium">
                {item.productName} × {item.quantity}
              </span>
              <span className="text-xs text-muted-foreground">
                {[
                  item.variantLabel,
                  item.flavourName,
                  item.eggEggless === "eggless"
                    ? "Eggless"
                    : item.eggEggless === "egg"
                      ? "Egg"
                      : null,
                  item.designPath ? "Custom design" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Standard"}
              </span>
              {!item.valid && item.invalidReason ? (
                <span role="alert" className="text-xs font-medium text-destructive">
                  {item.invalidReason}
                </span>
              ) : null}
              {formatPickupAt(item.pickupAt) ? (
                <span className="text-xs text-muted-foreground">
                  Pickup: {formatPickupAt(item.pickupAt)}
                </span>
              ) : null}
            </span>
            <span className="font-semibold">{formatPaise(item.lineTotalPaise, money)}</span>
          </div>
        ))}
      </section>

      <CouponForm currentCode={couponCode} coupon={quote.coupon} />

      <CheckoutForm
        itemIds={lines.map((item) => item.id)}
        contact={{ fullName: profile.fullName, phone: profile.phone ?? "", email: profile.email }}
        subtotalPaise={subtotalPaise}
        discountPaise={quote.discountTotalPaise}
        payablePaise={quote.payablePaise}
        applied={quote.applied}
        money={money}
        orderable={orderable}
        pickupSummary={orderPickupAt}
        pickup={{ address, instructions: settings?.pickupInstructions ?? null }}
      />

      <p className="text-center text-xs text-muted-foreground">
        <Link href={`${webstore}/cart`} className="font-medium text-primary hover:underline">
          Back to cart
        </Link>
      </p>
    </main>
  );
}
