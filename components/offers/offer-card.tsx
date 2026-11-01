import Link from "next/link";
import { ArrowRight, TicketPercent } from "lucide-react";

import { offerHref } from "@/lib/promotions/repository";
import { promotionSummary } from "@/lib/promotions/summary";
import type { Promotion } from "@/lib/promotions/types";
import type { MoneySettings } from "@/lib/store/format-helpers";

type OfferDestination = {
  categorySlug: string | null;
  productSlug: string | null;
};

/**
 * One offer in the customer offers rail.
 *
 * Pure server component: the mechanic line is derived from the promotion
 * config (never guessed), and the destination comes from the offer's own
 * configuration via the same `offerHref` resolver the hero uses. Banner
 * imagery renders only when the owner uploaded one; otherwise a calm
 * typographic card carries the offer.
 */
export function OfferCard({
  offer,
  webstore,
  money,
  destination,
}: {
  offer: Promotion;
  webstore: string;
  money: MoneySettings;
  destination: OfferDestination;
}) {
  const href = offerHref(offer, webstore, destination);
  const summary = promotionSummary(offer, money);
  const headline = offer.bannerTitle ?? offer.name;

  return (
    <Link
      href={href}
      className="group relative flex w-[19rem] shrink-0 snap-start flex-col justify-between gap-5 overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-6 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_24px_48px_-32px_rgb(66_40_16/0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 dark:border-white/10 dark:shadow-none"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-44 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_16%,transparent),transparent)] transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className="relative grid gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase">
          <TicketPercent aria-hidden="true" className="size-3.5" />
          {offer.bannerHeader ?? "Offer"}
        </span>
        <span className="font-serif text-[1.45rem] leading-[1.15] font-medium tracking-[-0.01em] text-balance">
          {headline}
        </span>
        <span className="text-sm leading-relaxed text-pretty text-muted-foreground">
          {offer.bannerDescription ?? summary}
        </span>
      </span>
      <span className="relative flex items-center justify-between gap-3">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          {summary}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          {offer.bannerCtaLabel ?? "Shop now"}
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </span>
      </span>
      {offer.hasCoupon ? (
        <span className="relative text-xs text-muted-foreground">
          Use a coupon code at checkout
        </span>
      ) : null}
    </Link>
  );
}
