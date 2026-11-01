import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { catalogAssetUrl } from "@/lib/catalog/repository";
import type { ProductCard as ProductCardData } from "@/lib/catalog/types";
import { formatPaise } from "@/lib/store/format-helpers";

/**
 * Customer product card.
 *
 * Editorial and calm: a soft image well with the price seated on it, a
 * single-line meta row, honest "From" pricing and quiet merchandising tags.
 * The whole card is one link; hover lifts the photo, never the text.
 */
export function ProductCard({
  card,
  webstore,
  money,
}: {
  card: ProductCardData;
  /** `/webstore/[uid]` prefix for detail links. */
  webstore: string;
  money: { currency: string; currencySymbol: string };
}) {
  const imageUrl = catalogAssetUrl(card.primaryImagePath);

  return (
    <Link
      href={`${webstore}/shop/${card.slug}`}
      className="group grid overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_18px_36px_-28px_rgb(66_40_16/0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_28px_48px_-28px_rgb(66_40_16/0.4)] dark:border-white/10 dark:shadow-none dark:hover:shadow-none"
    >
      <span className="relative block aspect-[5/4] overflow-hidden bg-muted/50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={card.primaryImageAlt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-full place-items-center bg-gradient-to-br from-secondary to-card font-serif text-4xl text-primary/50"
          >
            {card.name.slice(0, 1)}
          </span>
        )}
        {!card.isActive ? (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur-sm">
            Unavailable
          </span>
        ) : null}
        <span className="absolute right-3 bottom-3 rounded-full bg-background/85 px-3 py-1 text-sm font-semibold shadow-sm backdrop-blur-sm">
          {card.hasVariants
            ? `From ${formatPaise(card.fromPricePaise, money)}`
            : formatPaise(card.fromPricePaise, money)}
        </span>
      </span>
      <span className="grid gap-1.5 p-5">
        <span className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
          {card.categoryName ? <span>{card.categoryName}</span> : null}
          {card.isTrending ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary normal-case">
              Trending
            </span>
          ) : null}
          {card.isFeatured ? (
            <span className="rounded-full bg-berry/10 px-2 py-0.5 text-berry normal-case">
              Featured
            </span>
          ) : null}
        </span>
        <span className="font-heading text-[1.0625rem] leading-snug font-semibold tracking-tight">
          {card.name}
        </span>
        {card.shortDescription ? (
          <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {card.shortDescription}
          </span>
        ) : null}
        {card.allowCustomDesign ? (
          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-medium text-primary">
            <Sparkles aria-hidden="true" className="size-3" />
            Custom design available
          </span>
        ) : null}
      </span>
    </Link>
  );
}
