import { BadgePercent } from "lucide-react";

import { listActivePromotionsForProduct } from "@/lib/promotions/repository";

/**
 * Product-page offer hints (Phase 5).
 *
 * Names only — amounts stay server-side so nothing here can mislead. Actual
 * savings are computed by the promotion engine in the cart and at checkout.
 */
export async function ProductOffers({
  productId,
  categoryId,
}: {
  productId: string;
  categoryId: string | null;
}) {
  const offers = await listActivePromotionsForProduct(productId, categoryId);
  if (offers.length === 0) return null;

  return (
    <section
      aria-label="Offers on this product"
      className="grid gap-2 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <BadgePercent aria-hidden="true" className="size-4 text-primary" />
        Offers on this bake
      </p>
      <ul className="grid gap-1 text-xs text-muted-foreground">
        {offers.slice(0, 3).map((offer) => (
          <li key={offer.name}>
            {offer.name}
            {offer.couponRequired ? " · needs a coupon code" : " · applied automatically"}
          </li>
        ))}
      </ul>
    </section>
  );
}
