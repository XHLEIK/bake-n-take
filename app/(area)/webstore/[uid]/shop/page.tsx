import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { InlineMessage } from "@/components/auth/inline-message";
import { ProductCard } from "@/components/catalog/product-card";
import { ShopFilters } from "@/components/catalog/shop-filters";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { redirectIfUidMismatch, requireUser } from "@/lib/auth/session";
import {
  listCategories,
  listProducts,
  parseProductSort,
  PRODUCT_SORT_LABELS,
} from "@/lib/catalog/repository";
import { listOfferProductIds } from "@/lib/promotions/repository";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Bake list" };

type ShopParams = Promise<{ uid: string }>;
type ShopSearch = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Customer bake list.
 *
 * Same live query as before (search + category via GET params, so refresh,
 * back/forward and shared links preserve the filters). The catalogue opens
 * straight into search → rail → results under a controls band, with the
 * grid filling a second band — both content-height surfaces, no seams.
 */
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: ShopParams;
  searchParams: ShopSearch;
}) {
  const { uid } = await params;
  const query = await searchParams;
  const error = searchParamErrorCode(query);
  const session = await requireUser(`/webstore/${uid}/shop`);

  redirectIfUidMismatch(session, uid);

  const webstore = `/webstore/${uid}`;
  const q = first(query.q);
  const category = first(query.category) || undefined;
  const sort = parseProductSort(first(query.sort) || undefined);
  const offersOnly = first(query.offers) === "1";

  const [products, categories, settings, offerIds] = await Promise.all([
    listProducts({
      search: q || undefined,
      categorySlug: category,
      sort,
    }),
    listCategories(),
    getStoreSettings(),
    offersOnly ? listOfferProductIds() : Promise.resolve(new Set<string>()),
  ]);
  const visibleProducts = offersOnly ? products.filter((card) => offerIds.has(card.id)) : products;

  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };
  const activeCategory = categories.find((row) => row.slug === category);
  const resultTitle = q ? "Search results" : (activeCategory?.name ?? "All products");

  return (
    <div className="flex flex-1 flex-col">
      <div className="surface-counter">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 pt-8 pb-7 sm:px-8 lg:pt-10">
          {error ? <InlineMessage variant="error" message={authErrorMessage(error)} /> : null}
          <ShopFilters
            webstore={webstore}
            categories={categories}
            activeCategory={category}
            activeSort={sort}
            offersOnly={offersOnly}
            query={q}
          />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-4 px-5 py-8 sm:px-8 lg:py-10">
        {visibleProducts.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-16 text-center">
            <p className="font-serif text-2xl font-medium">
              {offersOnly
                ? "Nothing on offer right now."
                : activeCategory
                  ? `Nothing in ${activeCategory.name} yet.`
                  : q
                    ? "No fresh matches yet."
                    : "Nothing baked yet."}
            </p>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
              {offersOnly
                ? "Fresh deals land here often — meanwhile, browse everything the oven made today."
                : q || activeCategory
                  ? "Try another craving, or view everything the oven made today."
                  : "The ovens are warming up. Check back soon."}
            </p>
            {q || category || offersOnly ? (
              <Link
                href={`${webstore}/shop`}
                className="mt-1 inline-flex h-11 items-center gap-1.5 rounded-xl bg-secondary px-5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                View all products
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-1">
              <h1 className="font-heading text-lg font-semibold tracking-tight">{resultTitle}</h1>
              <p aria-live="polite" className="text-xs text-muted-foreground">
                {visibleProducts.length} bake{visibleProducts.length === 1 ? "" : "s"}
                {q ? ` for \u201c${q}\u201d` : ""}
                {q && activeCategory ? ` in ${activeCategory.name}` : ""}
                {sort !== "featured" ? ` · ${PRODUCT_SORT_LABELS[sort]}` : ""}
                {offersOnly ? " · On offer" : ""}
              </p>
            </div>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,12.5rem),1fr))] sm:gap-5 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] xl:grid-cols-[repeat(auto-fill,minmax(min(100%,16.5rem),1fr))]">
              {visibleProducts.map((card) => (
                <li key={card.id} className="min-w-0">
                  <ProductCard card={card} webstore={webstore} money={money} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
