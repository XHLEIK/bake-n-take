import type { Promotion } from "./types";
import { formatPaise } from "./format-helpers";

type Money = { currency: string; currencySymbol: string };

/**
 * Customer-facing, one-line mechanic summary.
 *
 * Derived ONLY from the promotion config the database already exposes —
 * never invented, never a percentage guessed from a name. Copy stays plain
 * and factual: "20% off", "Buy 2, get 1 free", "3 for ₹500".
 */
export function promotionSummary(promotion: Promotion, money: Money): string {
  const config = promotion.config;

  if ("percent" in config) {
    return `${config.percent}% off`;
  }
  if ("buy_qty" in config) {
    const reward =
      config.reward_kind === "free"
        ? "free"
        : config.reward_kind === "percent"
          ? `${config.reward_percent}% off`
          : `for ${formatPaise(config.reward_price_paise, money)}`;
    return `Buy ${config.buy_qty}, get ${config.reward_qty} ${reward}`;
  }
  if ("bundle_qty" in config) {
    return `${config.bundle_qty} for ${formatPaise(config.bundle_price_paise, money)}`;
  }
  if ("kind" in config) {
    return config.kind === "percent"
      ? `${config.value}% off your first order`
      : `${formatPaise(config.value, money)} off your first order`;
  }
  return promotion.name;
}
