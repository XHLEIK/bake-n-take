import type { HeroType } from "./types";

/**
 * Hero form initial values (Phase 5.1).
 *
 * Server-safe module (no "use client"): pages build these during render.
 * System slides are edited through enable/order only — never created here.
 */

export type HeroFormInitial = {
  id: string;
  type: Exclude<HeroType, "system">;
  displayOrder: string;
  priority: string;
  startsAt: string;
  endsAt: string;
  title: string;
  description: string;
  ctaLabel: string;
  galleryImagePath: string;
  bannerImageUrl: string | null;
  destType: "store" | "category" | "product";
  destCategoryId: string;
  destProductId: string;
  promotionId: string;
  productId: string;
  categoryId: string;
};

export function emptyHeroForm(): HeroFormInitial {
  return {
    id: "",
    type: "announcement",
    displayOrder: "0",
    priority: "100",
    startsAt: "",
    endsAt: "",
    title: "",
    description: "",
    ctaLabel: "",
    galleryImagePath: "",
    bannerImageUrl: null,
    destType: "store",
    destCategoryId: "",
    destProductId: "",
    promotionId: "",
    productId: "",
    categoryId: "",
  };
}
