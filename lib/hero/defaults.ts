/**
 * Evergreen system slides (Phase 5.1 §3).
 *
 * Controlled content, not homepage hardcode: the database rows carry
 * enable/order state (is_system/system_key), this module carries the
 * headline/description/CTA/image. The owner toggles and reorders the rows;
 * the final SAFE_FALLBACK below renders when nothing else qualifies, so the
 * hero area can never be empty.
 */

export type SystemSlideKey = "default_1" | "default_2" | "default_3";

export type SystemSlideContent = {
  key: SystemSlideKey;
  eyebrow: string;
  headline: string;
  description: string;
  cta: string;
  /** Seeded real photo (never a gradient, never a hotlink). */
  imagePath: string;
  /** default_2 points at the customizable experience, resolved per webstore. */
  hrefSuffix: string;
};

export const SYSTEM_SLIDES: Record<SystemSlideKey, SystemSlideContent> = {
  default_1: {
    key: "default_1",
    eyebrow: "Fresh from the oven",
    headline: "Freshly Baked, Made for You",
    description:
      "Cakes, cupcakes, brownies, cookies and more, freshly prepared for every occasion.",
    cta: "Explore Menu",
    imagePath: "banners/predefined-chocolate-cake.jpg",
    hrefSuffix: "/shop",
  },
  default_2: {
    key: "default_2",
    eyebrow: "Made to order",
    headline: "Make It Yours",
    description: "Customize your cake with your preferred flavour, size and design.",
    cta: "Customize Your Cake",
    imagePath: "banners/predefined-cupcakes.jpg",
    hrefSuffix: "/shop",
  },
  default_3: {
    key: "default_3",
    eyebrow: "Pickup, fresh daily",
    headline: "Order Today, Pick Up Fresh",
    description:
      "Choose your favourites, select your pickup date and collect your order fresh from the store.",
    cta: "Order Now",
    imagePath: "banners/predefined-bread.jpg",
    hrefSuffix: "/shop",
  },
};

export function isSystemSlideKey(value: unknown): value is SystemSlideKey {
  return value === "default_1" || value === "default_2" || value === "default_3";
}

/**
 * Last-resort slide: pure code constants, zero database or storage
 * dependency. Rendered only when every other source is exhausted.
 */
export const SAFE_FALLBACK_SLIDE = {
  key: "safe-fallback",
  eyebrow: "Welcome",
  headline: "Fresh Bakes Every Day",
  description: "Browse the bake list and order fresh for pickup.",
  cta: "Browse the Bake List",
  imagePath: "banners/predefined-cookies.jpg",
  hrefSuffix: "/shop",
} as const;
