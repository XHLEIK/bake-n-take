import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOwner } from "@/lib/auth/session";
import {
  getOwnerPromotion,
  listBannerGallery,
  listOfferCatalog,
} from "@/lib/promotions/repository";
import { isoToIstLocal } from "@/lib/promotions/validation";
import type { Promotion } from "@/lib/promotions/types";
import { OfferForm } from "@/components/offers/offer-form";
import type { OfferFormInitial } from "@/lib/promotions/form-defaults";
import { OfferRowActions } from "@/components/offers/offer-row-actions";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { formatPaise } from "@/lib/store/format";
import { getStoreSettings, storeAssetUrl } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Edit offer" };

type EditParams = Promise<{ id: string }>;

function rupees(paise: number): string {
  return String(paise / 100);
}

function toInitial(detail: {
  promotion: Promotion;
  targets: {
    targetType: string;
    targetRole: string;
    categoryId: string | null;
    productId: string | null;
  }[];
  coupons: { code: string }[];
}): OfferFormInitial {
  const { promotion } = detail;
  const config = promotion.config as Record<string, number | string>;
  const pick = (role: string, type: "category" | "product"): string[] =>
    detail.targets
      .filter((t) => t.targetRole === role && t.targetType === type)
      .map((t) => (type === "category" ? t.categoryId : t.productId))
      .filter((id): id is string => typeof id === "string");
  return {
    id: promotion.id,
    name: promotion.name,
    type: promotion.type,
    priority: promotion.priority >= 300 ? "high" : promotion.priority <= 50 ? "low" : "normal",
    isExclusive: promotion.isExclusive,
    isStackable: promotion.isStackable,
    autoApply: promotion.autoApply,
    repeatable: promotion.repeatable,
    startsAt: isoToIstLocal(promotion.startsAt),
    endsAt: isoToIstLocal(promotion.endsAt),
    minOrderRupees: promotion.minOrderPaise > 0 ? rupees(promotion.minOrderPaise) : "",
    maxDiscountRupees:
      promotion.maxDiscountPaise !== null ? rupees(promotion.maxDiscountPaise) : "",
    maxUsesGlobal: promotion.maxUsesGlobal !== null ? String(promotion.maxUsesGlobal) : "",
    maxUsesPerCustomer:
      promotion.maxUsesPerCustomer !== null ? String(promotion.maxUsesPerCustomer) : "",
    percent: String((config.percent as number) ?? 10),
    buyQty: String((config.buy_qty as number) ?? 2),
    rewardQty: String((config.reward_qty as number) ?? 1),
    rewardKind:
      config.reward_kind === "percent" || config.reward_kind === "price"
        ? config.reward_kind
        : "free",
    rewardPercent: String((config.reward_percent as number) ?? 50),
    rewardPriceRupees:
      typeof config.reward_price_paise === "number" && config.reward_price_paise > 0
        ? rupees(config.reward_price_paise)
        : "",
    bundleQty: String((config.bundle_qty as number) ?? 4),
    bundlePriceRupees:
      typeof config.bundle_price_paise === "number" ? rupees(config.bundle_price_paise) : "",
    foKind: config.kind === "percent" ? "percent" : "fixed",
    foValue:
      typeof config.value === "number"
        ? config.kind === "percent"
          ? String(config.value)
          : rupees(config.value)
        : "",
    categoryIds: pick("any", "category"),
    productIds: pick("any", "product"),
    triggerCategoryIds: pick("trigger", "category"),
    triggerProductIds: pick("trigger", "product"),
    rewardCategoryIds: pick("reward", "category"),
    rewardProductIds: pick("reward", "product"),
    couponsText: detail.coupons.map((c) => c.code).join("\n"),
    bannerTitle: promotion.bannerTitle ?? "",
    bannerDescription: promotion.bannerDescription ?? "",
    bannerCtaLabel: promotion.bannerCtaLabel ?? "",
    bannerStyle: promotion.bannerStyle,
    bannerImageUrl: storeAssetUrl(promotion.bannerImagePath),
    galleryImagePath: "",
    destType: promotion.destType,
    destCategoryId: promotion.destCategoryId ?? "",
    destProductId: promotion.destProductId ?? "",
  };
}

/** Owner offer editor (Phase 5): rules, coupons, banner, usage, danger zone. */
export default async function EditOfferPage({ params }: { params: EditParams }) {
  const { id } = await params;
  await requireOwner(`/owner/offers/${id}`);

  const [detail, catalog, settings, gallery] = await Promise.all([
    getOwnerPromotion(id),
    listOfferCatalog(),
    getStoreSettings(),
    listBannerGallery(),
  ]);
  if (!detail) notFound();
  const money = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/owner/offers" className="hover:underline">
          Offers
        </Link>
        {" · "}
        <span aria-current="page" className="text-foreground">
          {detail.promotion.name}
        </span>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
            Owner console
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {detail.promotion.name}
          </h1>
        </div>
        <OfferStatusBadge status={detail.effective} />
      </div>

      <section
        aria-label="Performance"
        className="grid gap-1 rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm"
      >
        <p className="text-xs text-muted-foreground">
          Claimed {detail.usage.redemptions} time{detail.usage.redemptions === 1 ? "" : "s"} ·{" "}
          {formatPaise(detail.usage.totalDiscountPaise, money)} given · counter{" "}
          {detail.promotion.usesCount}
          {detail.promotion.maxUsesGlobal ? `/${detail.promotion.maxUsesGlobal}` : ""}
        </p>
      </section>

      <OfferForm
        mode="edit"
        initial={toInitial(detail)}
        categories={catalog.categories}
        products={catalog.products}
        gallery={gallery}
      />

      <section
        aria-label="Danger zone"
        className="grid gap-3 rounded-2xl border border-destructive/30 p-4"
      >
        <h2 className="font-heading text-base font-semibold">Manage</h2>
        <OfferRowActions
          promotionId={detail.promotion.id}
          effective={detail.effective}
          baseStatus={detail.promotion.status}
          hasRedemptions={detail.usage.redemptions > 0}
        />
        <p className="text-xs text-muted-foreground">
          Delete is offered for drafts only. Offers with redemptions stay in history — archive them
          instead.
        </p>
      </section>
    </main>
  );
}
