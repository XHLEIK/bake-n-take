# Orders, Cart & Notifications (Phase 4)

Modular commerce monolith:

**Customer → configurator → cart/checkout → `create_order` RPC → orders +
snapshots + payment + event → trigger fan-out → notifications → Realtime →
owner console → `transition_order` RPC → events → customer notifications.**

## Architecture

### Database

| Table                  | Role                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `carts` / `cart_items` | One cart per customer; lines carry FK refs + snapshot columns (name, labels, unit paise, image) + quantity. Ephemeral — never history.                                                                                                                                                                      |
| `orders`               | Number (`BNK-YYYYMMDD-####` via locked daily counter), status, paise totals (subtotal/discount/tax/charges/grand; discount filled by the Phase 5 engine), currency, **contact snapshot**, payment method, idempotency key (unique). `customer_id` nulls on account delete — the snapshot preserves history. |
| `order_items`          | **Immutable snapshots** (name, slug, variant/flavour/egg/message, design path, unit × qty = line). Product FK is RESTRICT — ordered products cannot be hard-deleted.                                                                                                                                        |
| `payments`             | One row per order: method (`cod`/`pay_at_pickup` today; `upi`/`card`/`razorpay` reserved), status (`pending` → future `processing`/`success`/`failed`/`refunded`), amount, optional provider ref.                                                                                                           |
| `order_events`         | Append-only audit (type, from/to, actor, timestamp). The notification outbox source.                                                                                                                                                                                                                        |
| `order_assets`         | Design drafts promoted to order attachments (`kind='design'`).                                                                                                                                                                                                                                              |
| `order_counters`       | Daily sequence rows for order numbers.                                                                                                                                                                                                                                                                      |
| `notifications`        | Persisted inbox (recipient, type, title, message, entity, read state).                                                                                                                                                                                                                                      |

### RLS

Customers: own cart rows, own orders/items/payments/events/assets (ownership
subqueries), own notifications (select + mark-read update + own-row delete).
**No customer INSERT/UPDATE/DELETE on orders, items, payments, events or
assets** — those happen only inside definer functions. Owners: full order
visibility via `is_owner()`; catalog writes as before. The notification bell
is the only notification UI — there is no standalone notifications page.

### Transactions & idempotency

`create_order()` is one Postgres transaction: idempotency check → auth,
payment, contact, store-accepting validation → per-line revalidation +
repricing from `FOR UPDATE`-locked catalog rows → order number → order,
items, payment, event, purchased-cart cleanup → JSON result. Any failure
rolls everything back; nothing partial can exist.

`transition_order()` locks the order row (concurrent transitions serialize),
re-checks the caller (owner vs owning customer) and the edge map, then writes
status + event. Completing an order additionally requires the paid
confirmation: the payment row flips to `success` in the same transaction, so
completed orders display Paid and the completion notification says payment is
in. The TS map in `lib/orders/machine.ts` mirrors it for UI affordances only.

Idempotency keys (UUID per checkout render) make double-clicks and retries
return the original order. Back-button resubmits hit an emptied cart and
error instead of duplicating.

### Pricing integrity

`configurationTotalPaise()` (shared with Phase 3 previews) runs on database
paise in three places: cart display, cart mutations, and order creation. The
browser sends ids and options only. Future order totals must recompute the
same way server-side.

### Events → notifications (outbox without a worker)

`order_events` INSERT fires `notify_on_order_event()` in the same
transaction: ORDER_CREATED → customer ORDER_PLACED + NEW_ORDER to every
active owner; status events → customer copy; customer self-cancel →
customer + owners. Realtime only delivers; the rows are the history, so
offline users lose nothing and reconnects never duplicate.

### Realtime

`notifications`, `orders`, `order_events` are in the `supabase_realtime`
publication (full replica identity). The header bell subscribes
`recipient_id = own id` only — never the whole table — and refreshes server
data on arrival.

### Storage

`store-assets` (public product media) unchanged. `customer-designs`
(private): customers INSERT/DELETE under `tmp/<uid>/` only; owners read all;
everyone else denied. Order detail pages render drafts through short-lived
service-role signed URLs after an ownership check. Drafts stay at their
`tmp/` path once ordered (referenced by `order_assets`); a Phase 5 purge job
should delete `tmp/` files with no order attachment.

### Payments, future-ready

`payments.method`/`status` enums already include the gateway vocabulary;
`provider_ref` waits for Razorpay/UPI/card refs. Totals carry
discount/tax/charges columns; `discount_paise` is filled by the Phase 5
promotion engine (`promo_breakdown` + `coupon_code` snapshots alongside).
No gateway code, keys, or webhooks exist.

## Owner guide

**Orders** (`/owner/orders`): search by number/customer, status/date filters,
newest/oldest. Each row shows status, total, items. **Detail**: contact
snapshot, snapshot items with designs, totals, payment, timeline, and exactly
the legal next buttons (Confirm → Baking → Ready → Completed with a required
paid checkbox, plus Cancel with confirm). Completed orders show Paid and can
be deleted per-side from the order page (a customer delete hides it from the
customer while the owner keeps it, and vice versa; the row is removed only
once both sides deleted it). **Notifications**
arrive through the header bell (no standalone page) on new orders and
customer cancellations.

## Developer guide (Phase 5)

- Totals: recompute with `configurationTotalPaise()` over live rows at order
  time; snapshot name + paise into lines.
- Gateways: add method to the check + provider flow setting `payments` to
  `processing`/`success`/`failed` with `provider_ref`; keep COD untouched.
- Offers: filled by the Phase 5 engine — see `docs/OFFERS.md`. `discount_paise`
  (+ `promo_breakdown`, `coupon_code`, per-line `order_items.discount_paise`)
  is written before grand total; history is immutable.
- Pickup scheduling (§58): add nullable `pickup_at` + validate against
  `store_settings` hours/timezone; not built in Phase 4.
- Purge: delete `customer-designs/tmp/` files older than N days with no
  `order_assets` reference.

## Applied migration

`supabase/migrations/20260929090000_phase4_cart_orders_notifications.sql` —
tables, indexes, RLS, grants, realtime publication, both RPC functions, the
fan-out trigger. Applied via the Management API; idempotent for the SQL
editor.
