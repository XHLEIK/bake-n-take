import type { Metadata } from "next";
import Link from "next/link";

import { requireOwner } from "@/lib/auth/session";
import {
  listOfferCatalog,
  listBannerGallery,
  listPromotionOptions,
} from "@/lib/promotions/repository";
import { HeroForm } from "@/components/hero/hero-form";
import { emptyHeroForm } from "@/lib/hero/form-defaults";

export const metadata: Metadata = { title: "New slide" };

/** Owner hero slide creation (Phase 5.1). New slides start as drafts. */
export default async function NewHeroPage() {
  await requireOwner("/owner/hero/new");
  const [{ categories, products }, gallery, promotions] = await Promise.all([
    listOfferCatalog(),
    listBannerGallery(),
    listPromotionOptions(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/owner/hero" className="hover:underline">
          Hero Carousel
        </Link>
        {" · "}
        <span aria-current="page" className="text-foreground">
          New
        </span>
      </nav>
      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Owner console
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          New slide
        </h1>
        <p className="text-sm text-muted-foreground">
          Slides start as drafts — enable them when the content and schedule are ready.
        </p>
      </div>
      <HeroForm
        mode="create"
        initial={emptyHeroForm()}
        promotions={promotions}
        categories={categories}
        products={products}
        gallery={gallery}
      />
    </main>
  );
}
