# Product Catalog (Phase 3)

Single source of truth for everything sellable:

**Owner console → PostgreSQL + Storage → `lib/catalog` data layer → customer shop → detail → configuration preview.**

## Architecture

### Database — normalized, paise everywhere

| Table              | Role                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`       | Name-only groupings (name, slug, timestamps) managed inside the Products area — the category _is_ the product type                                                                                                                                                                              |     |
| `products`         | Slug (unique, stable for life), names, descriptions, `base_price_paise`, nullable category FK (**ON DELETE SET NULL** — orphans become uncategorized), variant mode, active/archived flags, featured/trending, custom-design toggle, egg/eggless + surcharge, message toggle, order, timestamps |
| `product_images`   | product FK (**CASCADE**), storage path, alt, order, `is_primary` (partial unique: one per product)                                                                                                                                                                                              |
| `product_variants` | product FK (CASCADE), label, value, `price_paise > 0`, active, order, unique per product                                                                                                                                                                                                        |
| `product_flavours` | product FK (CASCADE), name, `surcharge_paise ≥ 0`, active, order, unique per product                                                                                                                                                                                                            |

Money is **integer paise** in every column (`CHECK ≥ 0`, variants `≥ 1`).
Forms send decimal rupees; conversion happens once in `lib/catalog/validation`.
`formatPaise()` is the only renderer. Future discounts/taxes/payments build on
the same integers — no precision work needed.

Availability = two flags: `archived_at` (hidden from catalog, history kept),
`is_active` (visible but badged unavailable). Hard delete cascades children
and retires storage files; allowed only because no order phase exists yet —
**Phase 4 must gate deletion on order references.**

### Public vs owner reads

- Public (`lib/catalog/repository.ts`, key-only client, cached with tag
  `catalog`): all categories, non-archived products with joined children in
  one query; uncategorized products appear under All; RLS mirrors the same
  rules as defense in depth.
- Owner (`lib/catalog/owner-repository.ts`, session client, `requireOwner`
  callers): everything including archived, plus per-category product counts.

### RLS

Public `SELECT` (anon + authenticated) on categories and non-archived
products/children; owner `SELECT` via `is_owner()`; all writes (`ALL`)
owner-only via `is_owner()`. Grants mirror the policies; service role
bypasses for tooling.

### Storage

- `store-assets` (public): `products/<uuid>/…`, `categories/…` — owner-write,
  public-read policies already covered logo use; `next/image` locked to the
  `store-assets/**` path.
- `customer-designs` (**private**): customer drafts under `tmp/<uid>/…`.
  Customers INSERT/DELETE only their own prefix (RLS `auth.uid()` match);
  owners SELECT all (future fulfillment). Server validates magic bytes/size
  (5 MB) before upload; previews are local object URLs, never public links.
  Drafts are intentionally order-less in Phase 3 — Phase 4 attaches them to
  orders and purges the rest.

### Writes — `lib/catalog/actions.ts`

All owner actions start with `requireOwner` (DB role read). Notable rules:
slugs minted once (unique-suffixed) and never regenerated; assigned
categories re-verified (null = uncategorized, always allowed); child rows
diffed by id scoped to their product (one product can never touch another's
rows); uploads validated then stored, orphans rolled back on failure;
replaced files retired; `updateTag("catalog")` + layout revalidate on every
mutation. Category delete relies on the database (SET NULL) and reports that
products became uncategorized — deletion is never blocked and never cascades.

### Pricing integrity

Forms send labels + rupee strings only — **no totals cross the boundary**.
`configurationTotalPaise()` (shared with the future order server) computes
variant + flavour + eggless from database paise; the configurator preview is
UX, the database is authoritative.

## Owner guide

**Products** (`/owner/products`): search, category/status filters,
availability toggle, archive/restore, delete (two-step), per-row edit.
**Categories** live in the same area (no separate page): name-only create,
inline rename, delete — deleting nulls its products, which show as
uncategorized until reassigned. **New product** walks through basic info →
media → pricing/variants → flavours → customization → merchandising; images
stage locally and upload on save.

Practical notes: first image (or starred) is the card image; "From ₹X" shows
automatically with variants; unavailable products stay visible but badged;
archived ones vanish; renames never break `/shop/[slug]` links.

## Developer guide (read this before Phase 4)

- Read catalog: `listProducts(filters)`, `getProductBySlug(slug)`,
  `listCategories()` from `lib/catalog/repository` (server components only).
- Owner reads: `lib/catalog/owner-repository` behind `requireOwner`.
- Prices: integers (paise) from rows; preview with
  `configurationTotalPaise()`; render with `formatPaise(amount, settings)`.
  **Recompute every total server-side at order time — never accept a client
  total.**
- Stable identifiers for orders: product/variant/flavour **UUIDs + slugs**;
  snapshot name + paise into order lines (catalog rows keep evolving).
- Design drafts: `customer-designs` paths (`tmp/<uid>/…`); attach to orders,
  then delete or move them — add the purge job in Phase 4.
- Add a field: migration column + `types.ts` + `validation.ts` + form section
  - consumers; tag invalidation is automatic.

## Applied migration

`supabase/migrations/20260927090000_phase3_product_catalog.sql` — tables,
indexes, triggers, RLS, grants, private bucket + policies. Applied via the
Management API; idempotent for the SQL editor.
`supabase/migrations/20260928090000_phase3_categories_as_types.sql` —
drops the product-type system, slims categories to name-only, makes the
product category nullable with ON DELETE SET NULL. Applied via the
Management API; idempotent.
