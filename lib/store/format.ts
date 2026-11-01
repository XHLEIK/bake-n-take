import type { StoreSettings } from "./types";

/**
 * Centralized formatting helpers (Phase 2).
 *
 * Future commerce phases (products, orders, invoices) must format through
 * these using live store settings — never hardcode currency symbols or
 * locales at the call site.
 */

/** Formats a major-unit amount (e.g. 249.5) in the store currency. */
export function formatMoney(
  amount: number,
  settings: Pick<StoreSettings, "currency" | "currencySymbol">,
  locale = "en-IN",
): string {
  if (!Number.isFinite(amount)) return `${settings.currencySymbol}0`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: settings.currency,
    }).format(amount);
  } catch {
    return `${settings.currencySymbol}${amount.toFixed(2)}`;
  }
}

/**
 * Formats integer paise (e.g. 24950 → ₹249.50) — the canonical money
 * representation for the catalog and all future commerce phases.
 */
export function formatPaise(
  paise: number,
  settings: Pick<StoreSettings, "currency" | "currencySymbol">,
  locale = "en-IN",
): string {
  if (!Number.isInteger(paise) || paise < 0) return formatMoney(0, settings, locale);
  return formatMoney(paise / 100, settings, locale);
}

/** "Mon 09:00–21:00" style summary for one day, or "Closed". */
export function formatDayHours(day: {
  open: boolean;
  opens_at: string;
  closes_at: string;
}): string {
  if (!day.open) return "Closed";
  return `${day.opens_at}–${day.closes_at}`;
}
