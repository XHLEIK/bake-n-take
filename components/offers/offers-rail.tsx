import { Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { listActivePromotions, listPromotionTargets } from "@/lib/promotions/repository";
import { getStoreSettings } from "@/lib/store/repository";
import type { MoneySettings } from "@/lib/store/format-helpers";
import { SectionHeader } from "@/components/site/section-header";
import { OfferCard } from "./offer-card";

/**
 * Customer offers rail.
 *
 * A horizontal snap-scroll rail of the store's REAL active campaigns —
 * percentage, BOGO, mix-and-match, first-order, coupon-gated — each linking
 * to its configured destination (store / category / product) through the
 * same resolver the hero uses. No offers → the section collapses entirely
 * (never an empty bordered box). Pure server component: zero client JS.
 */
export async function OffersRail({ webstore }: { webstore: string }) {
  const [promotions, settings] = await Promise.all([listActivePromotions(), getStoreSettings()]);
  if (promotions.length === 0) return null;

  const targets = await listPromotionTargets(promotions.map((promotion) => promotion.id));
  const byPromo = new Map<string, { categoryId: string | null; productId: string | null }>();
  for (const target of targets) {
    if (!byPromo.has(target.promotionId)) {
      byPromo.set(target.promotionId, { categoryId: null, productId: null });
    }
    const entry = byPromo.get(target.promotionId)!;
    if (entry.categoryId === null && target.categoryId !== null)
      entry.categoryId = target.categoryId;
    if (entry.productId === null && target.productId !== null) entry.productId = target.productId;
  }

  const money: MoneySettings = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  const categoryIds = [
    ...new Set(
      [...byPromo.values()]
        .map((entry) => entry.categoryId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const productIds = [
    ...new Set(
      [...byPromo.values()]
        .map((entry) => entry.productId)
        .filter((id): id is string => id !== null),
    ),
  ];

  const client = await createClient();
  const [cats, prods] = await Promise.all([
    categoryIds.length > 0
      ? client.from("categories").select("id, slug").in("id", categoryIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    productIds.length > 0
      ? client.from("products").select("id, slug").in("id", productIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const categorySlugs = new Map(
    (((cats as { data: unknown }).data ?? []) as Record<string, unknown>[])
      .filter((row) => typeof row.id === "string" && typeof row.slug === "string")
      .map((row) => [row.id as string, row.slug as string]),
  );
  const productSlugs = new Map(
    (((prods as { data: unknown }).data ?? []) as Record<string, unknown>[])
      .filter((row) => typeof row.id === "string" && typeof row.slug === "string")
      .map((row) => [row.id as string, row.slug as string]),
  );

  const cards = promotions.slice(0, 8).map((offer) => {
    const destination = byPromo.get(offer.id) ?? { categoryId: null, productId: null };
    return (
      <OfferCard
        key={offer.id}
        offer={offer}
        webstore={webstore}
        money={money}
        destination={{
          categorySlug: destination.categoryId
            ? (categorySlugs.get(destination.categoryId) ?? null)
            : null,
          productSlug: destination.productId
            ? (productSlugs.get(destination.productId) ?? null)
            : null,
        }}
      />
    );
  });

  return (
    <div className="surface-offers">
      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <section aria-label="Current offers" className="grid gap-6">
          <SectionHeader eyebrow="Sweet deals" title="Offers this week" />
          <div className="relative">
            <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] sm:mx-0 sm:rounded-2xl sm:px-1">
              {cards}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
              <Sparkles aria-hidden="true" className="size-3.5 text-primary/70" />
              Swipe to see every offer
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
