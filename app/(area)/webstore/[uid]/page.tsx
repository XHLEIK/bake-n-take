import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { InlineMessage } from "@/components/auth/inline-message";
import { CategoryBrowser } from "@/components/catalog/category-browser";
import { ProductCard } from "@/components/catalog/product-card";
import { HeroCarousel } from "@/components/hero/hero-carousel";
import { OffersRail } from "@/components/offers/offers-rail";
import { SectionHeader } from "@/components/site/section-header";
import { AboutSection } from "@/components/store/about-section";
import { StoreStatusBanner } from "@/components/store/store-sections";
import { NewsletterSection } from "@/components/store/newsletter-section";
import { ReviewsSection } from "@/components/store/reviews-section";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { redirectIfUidMismatch, requireUser } from "@/lib/auth/session";
import { listCategories, listProducts } from "@/lib/catalog/repository";
import { getHeroSlides } from "@/lib/hero/select";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Webstore" };

type WebstoreParams = Promise<{ uid: string }>;
type WebstoreSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Customer storefront.
 *
 * Section-surface architecture (Option B): the page root is a solid base
 * that covers the stretched body wash, and every band paints exactly its
 * own content-height background — flat token tones or one radial glow that
 * fades inside its own box. No fixed layers, no repeated washes, so no
 * horizontal seams are possible. Sections hide themselves when their data
 * does not exist, and empty bands never render.
 *
 * Tonal rhythm alternates dark and light bands: dark bands scope the
 * `dark` theme to their subtree (a no-op when the page is already dark),
 * so every token-driven component inside adapts automatically in both
 * modes — hero dark, counter light, trending dark, featured light,
 * about warm, atelier dark, offers light, reviews dark, newsletter glow,
 * footer darkest.
 */
export default async function WebstorePage({
  params,
  searchParams,
}: {
  params: WebstoreParams;
  searchParams: WebstoreSearchParams;
}) {
  const { uid } = await params;
  const query = await searchParams;
  const error = searchParamErrorCode(query);
  const session = await requireUser(`/webstore/${uid}`);

  redirectIfUidMismatch(session, uid);

  const webstore = `/webstore/${uid}`;

  const [settings, categories, trending, featured, catalog, heroSlides] = await Promise.all([
    getStoreSettings(),
    listCategories(),
    listProducts({ trending: true, limit: 8 }),
    listProducts({ featured: true, limit: 4 }),
    listProducts({}),
    getHeroSlides(`/webstore/${uid}`),
  ]);
  const custom = catalog.filter((card) => card.allowCustomDesign).slice(0, 3);
  const counts = new Map<string, number>();
  for (const card of catalog) {
    if (!card.categorySlug) continue;
    counts.set(card.categorySlug, (counts.get(card.categorySlug) ?? 0) + 1);
  }
  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  return (
    <div className="bg-background">
      {/* ------------------------------------------------------ hero ----
          Warm ivory atmosphere in light, espresso in dark — fading
          inside its own box. */}
      <section aria-label="Highlights" className="surface-hero relative overflow-hidden">
        <div className="animate-rise mx-auto grid w-full max-w-7xl gap-4 px-5 pt-8 pb-12 sm:px-8 lg:pt-12 lg:pb-16">
          {error ? <InlineMessage variant="error" message={authErrorMessage(error)} /> : null}
          <HeroCarousel slides={heroSlides} />
          <StoreStatusBanner settings={settings} />
        </div>
      </section>

      {/* ------------------------------------------------ categories ----
          Warm counter surface: tiles stay prominent against it. */}
      {categories.length > 0 ? (
        <div className="surface-counter">
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
            <CategoryBrowser
              webstore={webstore}
              categories={categories}
              counts={counts}
              products={catalog}
              money={money}
            />
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------- trending ----
          Caramel-cream shelf in light, cocoa glow in dark. */}
      {trending.length > 0 ? (
        <div className="surface-trending">
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
            <section aria-label="Trending bakes" className="grid gap-6">
              <SectionHeader
                eyebrow="Most loved"
                title="Trending now"
                action={
                  <Link
                    href={`${webstore}/shop`}
                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View the bake list
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                }
              />
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {trending.slice(0, 8).map((card) => (
                  <li key={card.id}>
                    <ProductCard card={card} webstore={webstore} money={money} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------- featured ----
          Dark cocoa shelf: an intentional step down from Trending. */}
      {featured.length > 0 ? (
        <div className="surface-featured">
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
            <section aria-label="Featured bakes" className="grid gap-6">
              <SectionHeader eyebrow="Bakery picks" title="Featured from the counter" />
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {featured.map((card) => (
                  <li key={card.id}>
                    <ProductCard card={card} webstore={webstore} money={money} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}

      {/* ----------------------------------------------------- about ----
          Owner-editable About Us; hides itself when disabled. */}
      <AboutSection settings={settings} webstore={webstore} />

      {/* --------------------------------------------- customization ----
          Page base; the panel itself is the distinct surface. */}
      {custom.length > 0 ? (
        <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
          <section
            aria-label="Custom designs"
            className="relative grid gap-6 overflow-hidden rounded-[2rem] border border-border/70 bg-card/40 p-7 sm:p-10"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--berry)_14%,transparent),transparent)]"
            />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:items-center">
              <div className="grid gap-3">
                <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-berry/10 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.16em] text-berry uppercase">
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  Made to order
                </p>
                <h2 className="font-serif text-3xl leading-[1.1] font-medium tracking-[-0.01em] text-balance sm:text-4xl">
                  Create something that feels like yours.
                </h2>
                <p className="max-w-[42ch] text-sm leading-relaxed text-pretty text-muted-foreground">
                  Bring a photo, a sketch or just an idea. These bakes accept a custom design upload
                  — we will recreate it in icing and box it for pickup.
                </p>
                <Link
                  href={`${webstore}/shop`}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                >
                  Start a custom bake
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {custom.map((card) => (
                  <li key={card.id}>
                    <ProductCard card={card} webstore={webstore} money={money} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null}

      {/* ---------------------------------------------------- offers ----
          Page base; the rail owns its band and collapses when empty. */}
      <OffersRail webstore={webstore} />

      {/* --------------------------------------------------- reviews ----
          Soft mocha cream in light, quiet dark moment in dark. */}
      <div className="surface-reviews">
        <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
          <ReviewsSection />
        </div>
      </div>

      {/* ------------------------------------------------ newsletter ----
          Warm glow contained in its own generous band; the card keeps its
          border and radius, well clear of its neighbours. */}
      <div className="surface-news relative overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:py-20">
          <NewsletterSection />
        </div>
      </div>
    </div>
  );
}
