# Offers, Discounts & Promotion Engine (Phase 5)

One authoritative calculation path: `evaluate_order_promotions()` in
`supabase/migrations/20260933090000_phase5_promotions.sql`. Cart previews,
checkout previews and `create_order` all call it. The browser sends ids,
quantities and at most one coupon-code string — never prices, discounts or
eligibility.

## Promotion types

| Type          | Config (`config` jsonb)                                                                        | Behavior                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `percentage`  | `{percent}` (1–100)                                                                            | Off eligible lines (scope via targets, empty = store-wide).                                                                                                                                       |
| `buy_x_get_y` | `{buy_qty, reward_qty, reward_kind: free\|percent\|price, reward_percent, reward_price_paise}` | Trigger scope (`trigger` targets, empty = whole order) counts units; cheapest eligible reward units (`reward` targets, empty = trigger scope) are discounted. `repeatable` repeats per `buy_qty`. |
| `mix_match`   | `{bundle_qty ≥ 2, bundle_price_paise}`                                                         | Eligible pool (`any` targets, empty = whole order) groups cheapest-first; each complete bundle costs `bundle_price_paise`. `repeatable` forms multiple bundles; leftovers stay full price.        |
| `first_order` | `{kind: percent\|fixed, value}`                                                                | Whole-order reward for first-time customers (see below).                                                                                                                                          |

Coupons are a **gating mechanism, not a type**: any promotion with active
`promotion_coupons` rows requires its own code (`auto_apply` is forced off by
validation). One code per order.

## Database architecture

- `promotions` — campaign, base status (`draft|active|paused|archived`),
  priority (owner picks Show first / Normal / Show last → 300/100/10; higher
  wins ties), `is_exclusive`, `is_stackable`, `auto_apply`,
  `repeatable`, validity window, `min_order_paise`, `max_discount_paise`,
  `max_uses_global`, `max_uses_per_customer`, atomic `uses_count`, typed
  `config`, banner content (`banner_header` always mirrors the offer name;
  title/description suggest themselves from the setup until edited) +
  `banner_style` + `banner_image_path`
  (`store-assets/banners/…`), destination (`store|category|product` + FK,
  **derived from targeting**: one category → it, one product → it, else the
  bake list), audit timestamps.
- `promotion_targets` — FK relationships to existing categories/products
  (never copies), with `target_role` (`any|trigger|reward`). Cascades on
  catalog deletes, so promotions never dangle: unavailable targets simply
  stop matching.
- `promotion_coupons` — globally unique `code` (`^[A-Z0-9]{4,24}$`, stored
  uppercase), `is_active`. Never publicly readable. A public `has_coupon`
  flag on the promotion (maintained by owner actions) says only "a code is
  required" so the storefront can label offers honestly.
- `promotion_redemptions` — durable ledger: `promotion_id` (SET NULL),
  snapshots (`promotion_name`, `order_number`, `amount_paise`), `coupon_id`
  (SET NULL), `customer_id` (SET NULL), `order_id` (**no FK — survives order
  deletion**), `is_first_order`.
- `promotion_events` — owner audit trail (created/updated/activated/paused/
  archived/deleted/duplicated/coupon_changed/eligibility_changed/
  banner_changed).
- Snapshots: `orders.discount_paise` (now filled), `orders.promo_breakdown`
  (applied promos + amounts + coupon), `orders.coupon_code`,
  `order_items.discount_paise` (item-level rewards), `carts.coupon_code`
  (normalized code awaiting validation).

## Effective status

Stored status is only draft/active/paused/archived. `scheduled` and
`expired` are **derived** from the window (same predicate in SQL and in
`lib/promotions/status.ts`), so activation/expiry are automatic — no cron.
Owner transitions: draft→active/archived, active↔paused, any→archived;
archived is terminal. Deletion requires draft/archived **and** zero
redemptions (history stays auditable — archive instead).

## Eligibility rules

Evaluated per promotion, per quote, in this order: base status + window →
own coupon code (if gated) → minimum order (vs **original** subtotal) →
global limit → per-customer limit → first-order ledger → config sanity
(misconfigured promos are skipped, never break checkout). Only an
explicitly supplied bad coupon fails the order (`COUPON_INVALID`, generic
message — no existence/usage leaks).

## Discount calculation

- Integer paise everywhere. Percentage rewards use `floor()` (remainder stays
  with the store); bundle splits floor per unit for the same reason.
- `bigint` accumulators (no int4 overflow on large carts).
- Order-level percentages apply to **net** line amounts (after item-level
  rewards) — an item is never double-discounted.
- Total discount clamps to the subtotal; amounts never go negative.

## Stacking rules

Deterministic, no randomness:

1. Item-level (`buy_x_get_y`, `mix_match`): exactly **one** applies — best by
   (amount, priority, created). They rewrite unit pricing; combining is unsound.
2. Order-level: if any eligible **exclusive** promo exists, only the best
   exclusive applies (priority, amount, created). Otherwise the best
   non-stackable automatic promo **plus all** stackable automatic promos apply,
   plus every coupon-gated promo with a valid code (an explicit code always
   combines unless exclusivity wins).
3. Coupon-gated promos with a valid code **always combine** with automatic
   ones (explicit claim), unless an exclusive promo wins.
4. Ties break by higher priority, then earliest created.

## Coupon behavior

Uppercase-normalized, globally unique, active-flagged. Validation is
server-side in the engine on every quote and at commit. Invalid codes fail
with one generic message regardless of whether the code is unknown, paused,
expired, over-limit or inapplicable. Per-customer and global limits count
ledger rows, never visible orders.

## First-order behavior

> **Deleting/cancelling an order does not automatically restore first-order
> promotional eligibility once the promotion has been consumed.**

Eligibility = **no ledger row** (`is_first_order`) for the customer — never
"does an order row exist". The ledger has no FK to orders, so per-side
deletion and cancellation cannot restore it. A partial unique index allows
one first-order redemption per customer ever, making concurrent double-claims
fail atomically. Verified live: place → cancel → denied; place → complete →
per-side delete → denied, ledger intact, owner still sees the order
(13/13 checks, all fixtures removed afterwards).

## Order cancellation/deletion behavior

- Cancel: ledger untouched; eligibility stays consumed (explicit policy =
  no restoration).
- Per-side delete (completed orders): hides from the deleter's side only;
  ledger untouched; physical row removal (both sides deleted) still leaves
  redemptions behind.
- Redemption `uses_count` is not decremented on cancel/delete (conservative:
  limits count claims, documented here).

## Redemption lifecycle

Quote (no writes) → commit (`create_order`: lock promo rows → evaluate →
persist order/items snapshots → insert redemptions → bump `uses_count`, all
one transaction; `unique(promotion_id, order_id)` + order idempotency key make
retries safe; unique violations surface as `PROMOTION_CONSUMED`) → history
(order + ledger immutable; promo edits never rewrite history).

## Timezone

Store zone is Asia/Kolkata. Owner `datetime-local` inputs are interpreted as
IST wall time (fixed +05:30, no DST) and stored UTC; display uses `en-IN`
with `timeZone: "Asia/Kolkata"`. Window boundaries compare UTC instants, so
they are deterministic.

## Banner routing

Destinations are allow-listed (`store|category|product`) with FK references
resolved server-side to `/shop`, `/shop?category=slug`, `/shop/slug`. Owner
URLs are never honored. Banner image is either an uploaded `store-assets`
file (magic-byte validated, 2 MB, owner-only writes via existing bucket
policy) or one of six predefined gradient styles, or a previously uploaded
gallery image (verified server-side before saving).

## Security/RLS

- Promotions/targets: public `SELECT` on effective-active only; owners full.
- Coupons: owner-only (no public select, ever).
- Redemptions: customers read own, owners read all; writes definer-only.
- Events: owner-only.
- Engine binds authenticated callers to their own id (`NOT_AUTHORIZED`
  otherwise); service-role bypasses for tests/admin.
- RPC grants: `evaluate_order_promotions` + new `create_order` signature to
  authenticated/service_role only (old 5-arg overload dropped to avoid
  PostgREST ambiguity).

## Testing strategy

- Vitest (hermetic, per `docs/TESTING.md`): validation schemas, coupon
  normalization, IST conversion, status derivation/transitions, type mappers,
  owner-action guards, component rendering/routing.
- Live verification (throwaway scripts, fixtures removed): 11-case engine
  matrix (caps, min-order, BOGO repeat/partial, coupon gating/stacking/
  enumeration, exclusivity, first-order, mix bundles) and the 13-check
  first-order abuse scenario above.
- Manual E2E (owner): create → schedule → hero → cart → coupon → checkout →
  order snapshots → usage → pause/expire → archive/delete.

## Applied migration

`supabase/migrations/20260933090000_phase5_promotions.sql` — tables, FKs,
constraints, indexes, RLS, privileges, `evaluate_order_promotions`,
promo-aware `create_order(jsonb,jsonb,text,text,uuid[],text)`.
