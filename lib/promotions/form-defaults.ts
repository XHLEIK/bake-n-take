import type { BannerStyle, DestinationType, PromotionType } from "./types";

/**
 * Offer form initial values (Phase 5).
 *
 * Pure data factory kept OUTSIDE the client form component: the new-offer
 * page (a server component) calls emptyOfferForm() during render, which is
 * forbidden for functions exported from a "use client" module.
 */

export type OfferFormInitial = {
  id: string;
  name: string;
  type: PromotionType;
  /** Simple priority: high shows first, low shows last. */
  priority: "high" | "normal" | "low";
  isExclusive: boolean;
  isStackable: boolean;
  autoApply: boolean;
  repeatable: boolean;
  startsAt: string;
  endsAt: string;
  minOrderRupees: string;
  maxDiscountRupees: string;
  maxUsesGlobal: string;
  maxUsesPerCustomer: string;
  percent: string;
  buyQty: string;
  rewardQty: string;
  rewardKind: "free" | "percent" | "price";
  rewardPercent: string;
  rewardPriceRupees: string;
  bundleQty: string;
  bundlePriceRupees: string;
  foKind: "fixed" | "percent";
  foValue: string;
  categoryIds: string[];
  productIds: string[];
  triggerCategoryIds: string[];
  triggerProductIds: string[];
  rewardCategoryIds: string[];
  rewardProductIds: string[];
  couponsText: string;
  bannerTitle: string;
  bannerDescription: string;
  bannerCtaLabel: string;
  bannerStyle: BannerStyle;
  bannerImageUrl: string | null;
  galleryImagePath: string;
  destType: DestinationType;
  destCategoryId: string;
  destProductId: string;
};

export function emptyOfferForm(): OfferFormInitial {
  return {
    id: "",
    name: "",
    type: "percentage",
    priority: "normal",
    isExclusive: false,
    isStackable: false,
    autoApply: true,
    repeatable: false,
    startsAt: "",
    endsAt: "",
    minOrderRupees: "",
    maxDiscountRupees: "",
    maxUsesGlobal: "",
    maxUsesPerCustomer: "",
    percent: "10",
    buyQty: "2",
    rewardQty: "1",
    rewardKind: "free",
    rewardPercent: "50",
    rewardPriceRupees: "",
    bundleQty: "4",
    bundlePriceRupees: "",
    foKind: "fixed",
    foValue: "",
    categoryIds: [],
    productIds: [],
    triggerCategoryIds: [],
    triggerProductIds: [],
    rewardCategoryIds: [],
    rewardProductIds: [],
    couponsText: "",
    bannerTitle: "",
    bannerDescription: "",
    bannerCtaLabel: "",
    bannerStyle: "ember",
    bannerImageUrl: null,
    galleryImagePath: "",
    destType: "store",
    destCategoryId: "",
    destProductId: "",
  };
}
