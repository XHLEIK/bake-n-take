# Dynamic Hero & Store Highlights (Phase 5.1)

The homepage hero is a merchandising platform, not an offer banner. One
unified renderer (`HeroCarousel`) displays slides assembled server-side from
tiered sources — offers are one source among six. The home page (customer
store landing) carries the carousel; the bake list never does.

## Content types

`hero_items` rows reference existing records (never copies):

| Type           | Source                                          | Destination                       |
| -------------- | ----------------------------------------------- | --------------------------------- |
| `offer`        | Existing promotion (referenced, not duplicated) | The promotion's own destination   |
| `product`      | Existing product (one managed row per product)  | The product page                  |
| `category`     | Existing category                               | The category listing              |
| `announcement` | Free headline + description                     | Configured store/category/product |
| `campaign`     | General campaign + destination                  | Configured store/category/product |
| `system`       | Evergreen defaults (`lib/hero/defaults.ts`)     | Bake list                         |

## Selection engine

`selectHeroSlides` in `lib/hero/select.ts` is pure and deterministic:

1. Owner campaigns + featured offers (manual order, priority, created).
2. Explicitly featured products (managed hero rows).
3. New arrivals, automatic (`is_new` + `new_until`, most recently updated).
4. Category highlights.
5. Announcements.
6. Enabled default system slides.
7. Safe minimal fallback — the carousel is never empty.

Products dedupe across tiers (highest tier wins). Total slides cap at
`store_settings.hero_max_slides` (owner-configurable, 1–10, default 5).

## Scheduling

Stored status is `draft/active/paused/archived`; `scheduled`/`expired` derive
from the window with the same helpers as promotions, so activation and
expiry are automatic. Manual `display_order` sorts within a tier (up/down
reorder swaps with the neighbor); `priority` breaks ties.

## Fallback behavior

- No offers but featured products → featured + defaults fill the cap.
- Nothing but defaults → the three evergreen slides.
- Defaults disabled + nothing else → the safe fallback slide (code
  constants, zero database/storage dependency).
- A slide whose image is entirely unavailable renders as an intentional
  solid panel — never a broken `<img>`, never an empty hero.

## Validity (re-checked every render)

- Offer slides: promotion must exist and be effectively active.
- Product slides: product must exist, be active and unarchived.
- Category slides/destinations: rows must exist and be live.
- Announcements/campaigns: headline present, destination resolvable.
- Anything invalid is skipped in favor of lower tiers — never a dead CTA.

## Product merchandising

- **Mark as New** (`is_new` + optional `new_until`): automatic new-arrival
  eligibility, no hero row created, expiry automatic.
- **Feature in Hero Carousel**: upserts the product's single managed hero
  row (partial unique index — featuring can never duplicate). Untoggling
  pauses the row instead of deleting it. Hero title/description/button/image
  default from the product; the Hero manager offers full control.
- New and featured are independent: a product can be either, both, or neither.

## Images

Real photos only — no gradients in the hero. Sources, in order: the slide's
own upload, the source object's photo (product primary image, offer banner),
then a live gallery image (`store-assets/banners/`, listed from storage so
entries provably exist). Six predefined bakery photos are seeded from the
internet into `store-assets/banners/predefined-*.jpg`
(`scripts/seed-hero-images.mjs`, idempotent) and appear in every gallery
picker alongside owner uploads. Uploads are magic-byte validated (2 MB,
PNG/JPEG/WebP); gallery paths are allow-listed (`banners/…`) and
existence-checked server-side. Photos `object-cover` safely (text overlays,
never cropped); owner previews show desktop + mobile widths.

## Offer integration

Offer slides reference `promotions.id` — discount rules, coupons, dates and
config stay with the promotion engine (authoritative). An expired, paused,
archived or deleted promotion automatically drops its slide.

## Security/RLS

- `hero_items`: public `SELECT` on effective-active only; owners full.
- All mutations behind `requireOwner`; source/destination references
  verified at save; availability re-checked at display.
- Destinations are structural (`store|category|product` + FKs) — arbitrary
  external redirects are impossible.
- No client-provided publish state, pricing or eligibility anywhere.

## Testing strategy

- Vitest (hermetic): tier ordering, caps, dedupe, fallback (empty +
  imageless), scheduled/expired/paused exclusion, deleted-source and invalid
  destination exclusion, validation schemas, owner-action guards, carousel
  and form rendering.
- Live verification: migration apply, RLS policy audit, seeded-image
  reachability, owner CRUD smoke via the console.
- Manual E2E (owner): feature flow per content type, schedule windows,
  reorder, pause/resume, archive/delete, fallback with everything disabled.

## Applied migration

`supabase/migrations/20260934090000_phase51_hero_engine.sql` — product
flags, `store_settings.hero_max_slides`, `hero_items` (+ indexes, RLS,
grants), three seeded system rows.
