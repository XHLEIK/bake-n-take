"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { InlineMessage } from "@/components/auth/inline-message";
import {
  clearCartAction,
  removeCartItemAction,
  updateCartItemQuantityAction,
} from "@/lib/orders/actions";
import type { CartItem } from "@/lib/orders/types";
import { formatPickupAt } from "@/lib/orders/pickup";
import { formatPaise } from "@/lib/store/format";

/**
 * Interactive cart lines. Mutations run through owner-scoped server actions
 * and refresh server data afterwards; totals shown always come from the
 * server-priced lines, never from client math.
 */
export function CartLines({
  items,
  webstore,
  money,
  lineDiscounts,
}: {
  items: CartItem[];
  webstore: string;
  money: { currency: string; currencySymbol: string };
  /** Server-computed item-level offer savings by cart line id. */
  lineDiscounts?: Map<string, number>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function changeQuantity(item: CartItem, quantity: number) {
    setError(null);
    setPendingId(item.id);
    try {
      const result = await updateCartItemQuantityAction(item.id, quantity);
      if (result.status !== "success") setError(result.message ?? "Could not update your cart.");
      else refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const result = await removeCartItemAction(id);
      if (result.status !== "success") setError(result.message ?? "Could not update your cart.");
      else refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function clear() {
    setError(null);
    setClearing(true);
    try {
      const result = await clearCartAction();
      if (result.status !== "success") setError(result.message ?? "Could not clear your cart.");
      else refresh();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <InlineMessage variant="error" message={error} /> : null}
      <ul className="grid gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="grid gap-3 rounded-3xl border border-border/60 bg-card/60 p-4 sm:grid-cols-[1fr_auto] sm:p-5"
          >
            <div className="grid gap-1">
              <p className="font-medium">
                {item.productSlug ? (
                  <Link href={`${webstore}/shop/${item.productSlug}`} className="hover:underline">
                    {item.productName}
                  </Link>
                ) : (
                  item.productName
                )}
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
                  item.designPath ? "Custom design attached" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Standard"}
              </p>
              {!item.valid && item.invalidReason ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {item.invalidReason}
                </p>
              ) : (
                <p className="text-sm">
                  {formatPaise(item.unitPricePaise, money)}{" "}
                  <span className="text-muted-foreground">each</span>
                </p>
              )}
              {formatPickupAt(item.pickupAt) ? (
                <p className="text-xs text-muted-foreground">
                  Pickup: {formatPickupAt(item.pickupAt)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pendingId === item.id || item.quantity <= 1}
                  onClick={() => void changeQuantity(item, item.quantity - 1)}
                  aria-label="Decrease quantity"
                  className="grid size-9 place-items-center rounded-xl border border-border hover:border-primary/40 disabled:opacity-40"
                >
                  <Minus aria-hidden="true" className="size-4" />
                </button>
                <span aria-live="polite" className="min-w-6 text-center text-sm font-semibold">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  disabled={pendingId === item.id || item.quantity >= 99}
                  onClick={() => void changeQuantity(item, item.quantity + 1)}
                  aria-label="Increase quantity"
                  className="grid size-9 place-items-center rounded-xl border border-border hover:border-primary/40 disabled:opacity-40"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </button>
              </div>
              <div className="grid justify-items-end gap-1">
                <p className="text-sm font-semibold">{formatPaise(item.lineTotalPaise, money)}</p>
                {(lineDiscounts?.get(item.id) ?? 0) > 0 ? (
                  <p className="text-xs font-medium text-emerald-600">
                    −{formatPaise(lineDiscounts?.get(item.id) ?? 0, money)} with offer
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={pendingId === item.id}
                  onClick={() => void remove(item.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={clearing}
        onClick={() => void clear()}
        className="h-10 w-fit rounded-xl px-3 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {clearing ? "Clearing…" : "Clear cart"}
      </button>
    </div>
  );
}
