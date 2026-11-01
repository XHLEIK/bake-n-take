import { cache } from "react";

import { getCart } from "@/lib/orders/repository";
import { createClient } from "@/lib/supabase/server";

import { EMPTY_QUOTE, mapCartQuote, type CartQuote } from "./types";

/**
 * Server-side promotion quote (Phase 5).
 *
 * Builds repriced lines from the caller's own cart (never browser prices)
 * and runs them through evaluate_order_promotions — the same function
 * create_order uses at commit. The user id always comes from the session,
 * so the engine's caller binding cannot be bypassed from here.
 */

export const getCartQuote = cache(
  async (
    userId: string,
    itemIds: string[] = [],
  ): Promise<{ quote: CartQuote; couponCode: string | null }> => {
    const cart = await getCart(userId);
    if (!cart) return { quote: EMPTY_QUOTE, couponCode: null };
    const lines = cart.items.filter(
      (item) =>
        item.valid &&
        typeof item.productId === "string" &&
        (itemIds.length === 0 || itemIds.includes(item.id)),
    );
    if (lines.length === 0) return { quote: EMPTY_QUOTE, couponCode: cart.couponCode };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("evaluate_order_promotions", {
      p_customer_id: userId,
      p_items: lines.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_paise: item.unitPricePaise,
      })),
      p_coupon_code: cart.couponCode,
    });
    if (error || !data) return { quote: EMPTY_QUOTE, couponCode: cart.couponCode };
    const quote = mapCartQuote(data);
    // Zip engine positions back to cart lines (input order is preserved).
    const byIdx = new Map(quote.lines.map((line) => [line.idx, line]));
    return {
      quote: {
        ...quote,
        lines: lines.map((item, position) => {
          const line = byIdx.get(position + 1);
          return {
            idx: position + 1,
            cartItemId: item.id,
            productId: item.productId as string,
            quantity: item.quantity,
            unitPricePaise: item.unitPricePaise,
            discountPaise: line?.discountPaise ?? 0,
          };
        }),
      },
      couponCode: cart.couponCode,
    };
  },
);
