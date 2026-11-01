import type { Metadata } from "next";
import Link from "next/link";

import { CartLines } from "@/components/orders/cart-lines";
import { CouponForm } from "@/components/offers/coupon-form";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { InlineMessage } from "@/components/auth/inline-message";
import { redirectIfUidMismatch, requireUser } from "@/lib/auth/session";
import { getCart } from "@/lib/orders/repository";
import { getCartQuote } from "@/lib/promotions/quote";
import { formatPaise } from "@/lib/store/format";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Cart" };

type CartParams = Promise<{ uid: string }>;
type CartSearch = Promise<Record<string, string | string[] | undefined>>;

/**
 * Customer cart.
 *
 * Server-priced lines, coupon state and the promotion engine's quote — all
 * untouched — in a calmer two-part composition: lines left, sticky summary
 * right on desktop. Checkout stays blocked until every line is backed by
 * live data.
 */
export default async function CartPage({
  params,
  searchParams,
}: {
  params: CartParams;
  searchParams: CartSearch;
}) {
  const { uid } = await params;
  const query = await searchParams;
  const error = searchParamErrorCode(query);
  const session = await requireUser(`/webstore/${uid}/cart`);

  redirectIfUidMismatch(session, uid);

  const webstore = `/webstore/${uid}`;
  const [cart, settings] = await Promise.all([getCart(session.user.id), getStoreSettings()]);
  const { quote, couponCode } = await getCartQuote(session.user.id);
  const lineDiscounts = new Map(
    quote.lines
      .filter((line) => line.cartItemId !== null)
      .map((line) => [line.cartItemId as string, line.discountPaise]),
  );
  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 lg:py-14">
      {error ? <InlineMessage variant="error" message={authErrorMessage(error)} /> : null}

      <div className="grid gap-3">
        <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-primary/90 uppercase">
          Your basket
        </p>
        <h1 className="font-serif text-[2.25rem] leading-[1.08] font-medium tracking-[-0.015em] sm:text-5xl">
          Cart
        </h1>
      </div>

      {!cart || cart.items.length === 0 ? (
        <div className="grid gap-3 rounded-[2rem] border border-dashed border-border px-6 py-16 text-center">
          <p className="font-serif text-2xl font-medium">Your cart is empty.</p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            Warm bakes are waiting on the bake list — come pick a box.
          </p>
          <Link
            href={`${webstore}/shop`}
            className="brand-surface mx-auto mt-2 inline-flex h-12 items-center rounded-2xl px-6 text-sm font-semibold text-primary-foreground"
          >
            Browse the bake list
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
          <CartLines
            items={cart.items}
            webstore={webstore}
            money={money}
            lineDiscounts={lineDiscounts}
          />

          <div className="grid gap-4 lg:sticky lg:top-24">
            <CouponForm currentCode={couponCode} coupon={quote.coupon} />
            <div className="grid gap-3 rounded-3xl border border-border/70 bg-card/80 p-5 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_24px_48px_-36px_rgb(66_40_16/0.4)] dark:border-white/10 dark:shadow-none">
              <p className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  Subtotal · {cart.unitCount} item{cart.unitCount === 1 ? "" : "s"}
                </span>
                <span className="font-heading text-lg font-semibold">
                  {formatPaise(cart.subtotalPaise, money)}
                </span>
              </p>
              {quote.applied.map((applied) => (
                <p
                  key={applied.promotionId}
                  className="flex items-baseline justify-between text-sm"
                >
                  <span className="text-sage">
                    {applied.name}
                    {applied.couponCode ? ` · ${applied.couponCode}` : ""}
                  </span>
                  <span className="font-medium text-sage">
                    −{formatPaise(applied.amountPaise, money)}
                  </span>
                </p>
              ))}
              {quote.discountTotalPaise > 0 ? (
                <p className="flex items-baseline justify-between border-t border-border/70 pt-3 text-base font-semibold">
                  <span>Total to pay</span>
                  <span className="font-heading text-xl">
                    {formatPaise(quote.payablePaise, money)}
                  </span>
                </p>
              ) : null}
              {!cart.orderable ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  Some items changed since you added them — update or remove them to check out.
                </p>
              ) : null}
              {cart.orderable ? (
                <Link
                  href={`${webstore}/checkout`}
                  className="brand-surface mt-1 inline-flex h-13 items-center justify-center rounded-2xl text-[0.9375rem] font-semibold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.99]"
                >
                  Proceed to checkout
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="mt-1 inline-flex h-13 cursor-not-allowed items-center justify-center rounded-2xl bg-muted px-5 text-sm font-medium text-muted-foreground"
                >
                  Proceed to checkout
                </span>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Pickup only · Pay cash or UPI at the counter
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
