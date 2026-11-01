"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tag, X } from "lucide-react";

import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { applyCouponAction, removeCouponAction } from "@/lib/promotions/actions";

/**
 * Coupon code form (Phase 5).
 *
 * The code is saved on the cart; the engine decides validity on every quote
 * and at order creation. Only the format is checked client-side — existence
 * and eligibility never leak through this form.
 */
export function CouponForm({
  currentCode,
  coupon,
}: {
  currentCode: string | null;
  coupon: { valid: boolean; message: string } | null;
}) {
  const router = useRouter();
  const [applyState, applyAction] = useActionState(
    async (_previous: typeof INITIAL_AUTH_FORM_STATE, formData: FormData) =>
      applyCouponAction(String(formData.get("code") ?? "")),
    INITIAL_AUTH_FORM_STATE,
  );
  const [removeState, removeAction] = useActionState(
    async () => removeCouponAction(),
    INITIAL_AUTH_FORM_STATE,
  );

  const changed = applyState.status === "success" || removeState.status === "success";
  useEffect(() => {
    if (changed) router.refresh();
  }, [changed, router]);

  const error = [applyState, removeState].find((s) => s.status === "error")?.message;

  return (
    <div className="grid gap-2 rounded-3xl border border-border/60 bg-card/60 p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Tag aria-hidden="true" className="size-4 text-primary" />
        Coupon code
      </p>
      {error ? <InlineMessage variant="error" message={error} /> : null}
      {currentCode ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-secondary px-2.5 py-1.5 font-mono text-xs font-semibold tracking-wider">
            {currentCode}
          </span>
          {coupon ? (
            <span
              role="status"
              className={
                coupon.valid
                  ? "text-xs text-emerald-600"
                  : "text-xs text-amber-700 dark:text-amber-300"
              }
            >
              {coupon.message}
            </span>
          ) : null}
          <form action={removeAction} className="ml-auto">
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden="true" className="size-3.5" />
              Remove
            </button>
          </form>
        </div>
      ) : (
        <form action={applyAction} className="flex gap-2">
          <label htmlFor="coupon-code" className="sr-only">
            Coupon code
          </label>
          <input
            id="coupon-code"
            name="code"
            placeholder="e.g. SUMMER50"
            autoComplete="off"
            maxLength={24}
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 font-mono text-sm uppercase placeholder:normal-case"
          />
          <SubmitButton pendingLabel="Applying…" className="h-10 w-auto px-4 text-sm">
            Apply
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
