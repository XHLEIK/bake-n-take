export { formatPaise, formatMoney } from "@/lib/store/format";

/** The money settings shape every formatting call needs. */
export type MoneySettings = { currency: string; currencySymbol: string };
