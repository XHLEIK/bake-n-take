import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Configurator } from "@/components/catalog/configurator";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { ProductOffers } from "@/components/offers/product-offers";
import { InlineMessage } from "@/components/auth/inline-message";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { redirectIfUidMismatch, requireUser } from "@/lib/auth/session";
import { catalogAssetUrl, getProductBySlug } from "@/lib/catalog/repository";
import { getStoreSettings } from "@/lib/store/repository";

type DetailParams = Promise<{ uid: string; slug: string }>;
type DetailSearch = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: DetailParams }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const image = catalogAssetUrl(product.images[0]?.storagePath ?? null);
  return {
    title: product.name,
    description: product.shortDescription || product.description.slice(0, 160) || undefined,
    openGraph: {
      title: product.name,
      description: product.shortDescription || undefined,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

/**
 * Customer product detail.
 *
 * A calm two-column composition: gallery left, everything configurable right.
 * The configurator, offers and descriptions keep their existing logic and
 * data; the presentation answers the four customer questions at a glance —
 * what is this, what can I change, what does it cost, what will I pay.
 */
export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: DetailParams;
  searchParams: DetailSearch;
}) {
  const { uid, slug } = await params;
  const query = await searchParams;
  const error = searchParamErrorCode(query);
  const session = await requireUser(`/webstore/${uid}/shop/${slug}`);

  redirectIfUidMismatch(session, uid);

  const [product, settings] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product) notFound();

  const webstore = `/webstore/${uid}`;
  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  return (
    <main className="flex flex-1 flex-col">
      <div className="surface-counter">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:py-12">
          {error ? <InlineMessage variant="error" message={authErrorMessage(error)} /> : null}

          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Link
              href={`${webstore}/shop`}
              className="rounded-sm hover:text-foreground hover:underline"
            >
              Bake list
            </Link>
            <ChevronRight aria-hidden="true" className="size-3.5 text-border" />
            {product.categorySlug ? (
              <Link
                href={`${webstore}/shop?category=${product.categorySlug}`}
                className="rounded-sm hover:text-foreground hover:underline"
              >
                {product.categoryName}
              </Link>
            ) : (
              <span>{product.categoryName || "Bakery"}</span>
            )}
            <ChevronRight aria-hidden="true" className="size-3.5 text-border" />
            <span aria-current="page" className="text-foreground">
              {product.name}
            </span>
          </nav>

          {!product.isActive ? (
            <InlineMessage
              variant="info"
              message="This product is currently unavailable — you can still browse its options."
            />
          ) : null}

          <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ProductGallery product={product} />
            </div>

            <div className="grid content-start gap-6">
              <div className="grid gap-2.5">
                <p className="flex flex-wrap items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                  {product.categoryName ? (
                    <span className="text-primary/90">{product.categoryName}</span>
                  ) : null}
                  {product.isFeatured ? (
                    <span className="rounded-full bg-berry/10 px-2 py-0.5 text-berry normal-case tracking-normal">
                      Featured
                    </span>
                  ) : null}
                  {product.isTrending ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary normal-case tracking-normal">
                      Trending
                    </span>
                  ) : null}
                </p>
                <h1 className="font-serif text-[2.1rem] leading-[1.08] font-medium tracking-[-0.015em] text-balance sm:text-4xl">
                  {product.name}
                </h1>
                {product.shortDescription ? (
                  <p className="text-base leading-relaxed text-pretty text-muted-foreground">
                    {product.shortDescription}
                  </p>
                ) : null}
              </div>

              <Configurator
                product={product}
                money={money}
                webstoreUid={uid}
                hours={settings?.hours ?? null}
              />

              <ProductOffers productId={product.id} categoryId={product.categoryId} />

              {product.description ? (
                <div className="grid gap-2 border-t border-border/70 pt-5">
                  <h2 className="font-heading text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    About this bake
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-pretty text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
