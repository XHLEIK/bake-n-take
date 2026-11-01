"use client";

import { useActionState, useState } from "react";
import { Banknote, Store } from "lucide-react";
import { cn } from "cn";

import { FormField } from "@/components/auth/form-field";
import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { placeOrderAction } from "@/lib/orders/actions";
import { formatPaise } from "@/lib/store/format";

/**
 * Checkout form: contact details, COD/Pay-at-Pickup choice, totals, confirm.
 *
 * Contact fields prefill from the profile but save only into the order
 * snapshot — the account profile is never overwritten. One idempotency key
 * per render makes double-clicks and retries collapse into one order. The
 * discount preview comes from the server promotion engine; placement
 * recomputes everything authoritatively.
 */
export function CheckoutForm({
  itemIds,
  contact,
  subtotalPaise,
  discountPaise,
  payablePaise,
  applied,
  money,
  orderable,
  pickupSummary,
  pickup,
}: {
  itemIds: string[];
  contact: { fullName: string; phone: string; email: string };
  subtotalPaise: number;
  /** Server-computed preview (recomputed authoritatively at placement). */
  discountPaise: number;
  payablePaise: number;
  applied: { name: string; amountPaise: number; couponCode: string | null }[];
  money: { currency: string; currencySymbol: string };
  orderable: boolean;
  /** Latest requested pickup across the lines (display only). */
  pickupSummary: string | null;
  pickup: { address: string | null; instructions: string | null };
}) {
  const [state, formAction] = useActionState(placeOrderAction, INITIAL_AUTH_FORM_STATE);
  const [method, setMethod] = useState<"cod" | "pay_at_pickup">("pay_at_pickup");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction} className="grid gap-6">
      {itemIds.map((id) => (
        <input key={id} type="hidden" name="itemId" value={id} />
      ))}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {state.status === "error" && state.message ? (
        <InlineMessage variant="error" message={state.message} />
      ) : null}

      <section
        aria-label="Your details"
        className="grid gap-4 rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-6"
      >
        <h2 className="font-heading text-base font-semibold">Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Full name"
            name="fullName"
            autoComplete="name"
            required
            maxLength={80}
            defaultValue={contact.fullName}
            error={state.fieldErrors?.fullName}
          />
          <FormField
            label="Phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={20}
            defaultValue={contact.phone}
            error={state.fieldErrors?.phone}
          />
        </div>
        <FormField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={contact.email}
          error={state.fieldErrors?.email}
        />
      </section>

      <section
        aria-label="Payment"
        className="grid gap-3 rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-6"
      >
        <h2 className="font-heading text-base font-semibold">Payment</h2>
        <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
          {(
            [
              {
                value: "pay_at_pickup",
                label: "Pay at Pickup",
                hint: "Cash (or UPI at the counter) when you collect.",
                icon: Store,
              },
              {
                value: "cod",
                label: "Cash on Pickup",
                hint: "Pay cash when you collect your order.",
                icon: Banknote,
              },
            ] as const
          ).map((option) => {
            const selected = method === option.value;
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border hover:border-primary/40",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.value}
                  checked={selected}
                  onChange={() => setMethod(option.value)}
                  className="size-4 accent-current"
                />
                <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="grid gap-0.5">
                  <span>{option.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Pickup"
        className="grid gap-2 rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-6"
      >
        <h2 className="font-heading text-base font-semibold">Pickup — no delivery</h2>
        <p className="text-sm text-muted-foreground">
          This order is for <strong className="text-foreground">pickup from the store</strong>.
        </p>
        {pickupSummary ? <p className="text-sm font-medium">Collect: {pickupSummary}</p> : null}
        {pickup.address ? <p className="text-sm">{pickup.address}</p> : null}
        {pickup.instructions ? (
          <p className="text-xs text-muted-foreground">{pickup.instructions}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          We will confirm your order first — come over once it is marked ready.
        </p>
      </section>

      <section
        aria-label="Order summary"
        className="grid gap-2 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_24px_48px_-36px_rgb(66_40_16/0.4)] sm:p-6 dark:border-white/10 dark:shadow-none"
      >
        <h2 className="font-heading text-base font-semibold">Order summary</h2>
        <dl className="grid gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatPaise(subtotalPaise, money)}</dd>
          </div>
          {applied.map((offer) => (
            <div
              key={`${offer.name}-${offer.couponCode ?? "auto"}`}
              className="flex justify-between"
            >
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
            <dd>{formatPaise(discountPaise, money)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Total to pay at pickup</dt>
            <dd>{formatPaise(payablePaise, money)}</dd>
          </div>
        </dl>
        {orderable ? (
          <SubmitButton pendingLabel="Placing your order…">Confirm and place order</SubmitButton>
        ) : (
          <p role="alert" className="text-xs font-medium text-destructive">
            Some items changed — go back to the cart and review them before ordering.
          </p>
        )}
      </section>
    </form>
  );
}
