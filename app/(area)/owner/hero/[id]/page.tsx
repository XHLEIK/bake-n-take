import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOwner } from "@/lib/auth/session";
import { getOwnerHeroItem } from "@/lib/hero/repository";
import type { HeroFormInitial } from "@/lib/hero/form-defaults";
import { HeroForm } from "@/components/hero/hero-form";
import { HeroRowActions } from "@/components/hero/hero-row-actions";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import {
  listBannerGallery,
  listOfferCatalog,
  listPromotionOptions,
} from "@/lib/promotions/repository";
import { effectiveStatus } from "@/lib/promotions/status";
import { isoToIstLocal } from "@/lib/promotions/validation";
import { storeAssetUrl } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Edit slide" };

type EditParams = Promise<{ id: string }>;

/** Owner hero slide editor (Phase 5.1): content, schedule, image, manage. */
export default async function EditHeroPage({ params }: { params: EditParams }) {
  const { id } = await params;
  await requireOwner(`/owner/hero/${id}`);

  const [item, catalog, gallery, promotions] = await Promise.all([
    getOwnerHeroItem(id),
    listOfferCatalog(),
    listBannerGallery(),
    listPromotionOptions(),
  ]);
  if (!item || item.isSystem) notFound();

  const initial: HeroFormInitial = {
    id: item.id,
    type: item.type === "system" ? "announcement" : item.type,
    displayOrder: String(item.displayOrder),
    priority: String(item.priority),
    startsAt: isoToIstLocal(item.startsAt),
    endsAt: isoToIstLocal(item.endsAt),
    title: item.title ?? "",
    description: item.description ?? "",
    ctaLabel: item.ctaLabel ?? "",
    galleryImagePath: "",
    bannerImageUrl: storeAssetUrl(item.imagePath),
    destType: item.destType,
    destCategoryId: item.destCategoryId ?? "",
    destProductId: item.destProductId ?? "",
    promotionId: item.promotionId ?? "",
    productId: item.productId ?? "",
    categoryId: item.categoryId ?? "",
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/owner/hero" className="hover:underline">
          Hero Carousel
        </Link>
        {" · "}
        <span aria-current="page" className="text-foreground">
          {item.title ?? item.type}
        </span>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
            Owner console
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {item.title ?? "Slide"}
          </h1>
        </div>
      </div>

      <HeroForm
        mode="edit"
        initial={initial}
        promotions={promotions}
        categories={catalog.categories}
        products={catalog.products}
        gallery={gallery}
      />

      <section
        aria-label="Manage"
        className="grid gap-3 rounded-2xl border border-destructive/30 p-4"
      >
        <h2 className="font-heading text-base font-semibold">Manage</h2>
        <OfferStatusBadge status={effectiveStatus(item.status, item.startsAt, item.endsAt)} />
        <HeroRowActions
          heroId={item.id}
          effective={item.status}
          baseStatus={item.status}
          isSystem={false}
        />
        <p className="text-xs text-muted-foreground">
          Delete is offered for drafts only. Slides with history stay archived instead.
        </p>
      </section>
    </main>
  );
}
