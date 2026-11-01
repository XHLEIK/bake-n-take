# Phase 5 — Offers, Discounts & Promotion Engine

## ROLE

Act as a senior staff-level full-stack engineer, backend architect, database architect, security engineer, QA engineer and DevOps engineer.

Implement Phase 5 as a **production-grade, secure, extensible promotion and discount engine** for the bakery web store.

This phase is business-critical.

Do not implement discounts as frontend calculations.

Do not trust prices, discount amounts, eligibility, coupon validity, quantities, or promotion IDs supplied by the client.

Every promotion decision and every final monetary calculation must be **authoritatively validated and calculated server-side** against the current database state.

The implementation must integrate cleanly with Phases 1–4 without breaking authentication, products, categories, cart, checkout, orders, notifications or existing pricing behavior.

---

# 1. BEFORE CODING

First inspect the complete existing codebase.

Use the existing Graphify/project indexing capabilities to understand the current architecture before modifying anything.

Read and understand:

- Phase 1 authentication
- Phase 2 store settings
- Phase 3 products/categories
- Phase 4 cart
- Phase 4 checkout
- Phase 4 orders
- Phase 4 pricing
- Phase 4 payment abstraction
- Existing order lifecycle
- Existing Supabase/Postgres schema
- Existing RLS policies
- Existing storage configuration
- Existing owner authorization
- Existing customer authorization
- Existing UI/design system
- Existing notification architecture
- Existing testing infrastructure

Do not duplicate existing functionality.

Do not introduce a second pricing system.

Do not create a second product/category system.

Do not create a second cart/order system.

Build the promotion engine as a clean extension of the existing architecture.

---

# 2. PROMOTION SYSTEM GOAL

Create a centralized promotion system that allows the owner to create, configure, activate, pause, edit and delete promotional campaigns from an **Owner → Offers** page.

Customers should see active promotions on the customer web store.

Promotions must be automatically evaluated during cart/checkout/order creation.

The owner should be able to control promotions without developer intervention.

The system must support future promotion types without requiring a complete rewrite.

---

# 3. OWNER OFFERS PAGE

Create a professional owner-side Offers management system.

The owner should be able to:

- View all offers
- Search offers
- Filter offers
- Sort offers
- Create offers
- Edit offers
- Duplicate offers
- Activate offers
- Pause offers
- Schedule offers
- Expire offers automatically
- Delete/archive offers
- View offer performance/usage
- View current status
- Preview customer-facing banner
- Configure customer-facing content

Statuses should support concepts such as:

- Draft
- Scheduled
- Active
- Paused
- Expired
- Archived

Do not allow invalid status transitions.

---

# 4. OFFER TYPES

Design the promotion model so these promotion types are first-class supported types.

## TYPE A — PERCENTAGE DISCOUNT

Examples:

- 10% off
- 20% off
- 50% off

Owner must be able to configure the scope.

### Scope options

- Entire store
- Specific category/categories
- Specific product/products
- Specific product group

### Additional rules

Support:

- Minimum order amount
- Maximum discount amount
- Start date/time
- End date/time
- Customer eligibility
- Usage limits
- Per-customer usage limits

Example:

> 50% OFF Cakes — Maximum ₹500 discount

If the calculated discount is ₹750, the applied discount must be ₹500.

---

# 5. TYPE B — BUY X GET Y

Support quantity-based promotions.

Examples:

- Buy 1 Get 1 Free
- Buy 2 Get 1 Free
- Buy 2 Get 1 at 50% off
- Buy 3 Get 2 Free
- Buy 5 Get 1 at ₹X

The promotion model should be flexible enough to represent:

- Trigger quantity
- Reward quantity
- Reward discount percentage
- Reward fixed price
- Eligible trigger products
- Eligible reward products
- Eligible categories
- Product groups

Examples:

### Buy 1 Get 1 Free

Buy 1 eligible cupcake → cheapest eligible cupcake free.

### Buy 2 Get 1 Free

Buy 2 eligible cupcakes → 1 eligible cupcake free.

### Buy 2 Get 1 at 50% Off

Buy 2 eligible products → third eligible product receives 50% discount.

Carefully define how multiple qualifying quantities work.

For example:

Buy 4 → should potentially qualify for two Buy-2-Get-1 rewards if the owner has enabled repeat application.

Do not accidentally apply infinite rewards.

Owner must be able to configure whether the promotion:

- Applies once per order
- Repeats based on qualifying quantity

---

# 6. TYPE C — MIX & MATCH / ANY N FOR ₹X

Support:

> Any 2 for ₹150

> Any 3 for ₹199

> Any 4 for ₹299

Owner selects eligible products/categories.

Example:

Eligible products:

- Chocolate Cupcake
- Vanilla Cupcake
- Red Velvet Cupcake
- Butterscotch Cupcake

Promotion:

> Any 4 → ₹299

Customers can mix eligible products.

The engine must correctly calculate the bundle price regardless of which eligible combination the customer chooses.

Support repeated bundles where configured.

Example:

8 eligible products could potentially form two groups of 4.

The engine must prevent incorrect discounting of quantities that do not complete a bundle.

---

# 7. TYPE D — FIRST ORDER / FIRST-TIME CUSTOMER DISCOUNT

Support promotions such as:

> First order ₹100 off

> First order 20% off

> New customer ₹150 off

Owner must be able to configure:

- Percentage discount
- Fixed discount
- Minimum order amount
- Maximum discount
- Start/end date
- Per-customer eligibility
- Optional coupon requirement

## CRITICAL ANTI-ABUSE REQUIREMENT

Do NOT determine first-order eligibility merely by checking:

> "Does this customer currently have an order?"

That is insecure.

A customer must not regain first-order eligibility simply because:

- They deleted an order
- Owner deleted an order
- Order was cancelled
- Order was refunded
- Order was otherwise removed from the visible order history

Once a customer has **successfully consumed/claimed a first-order promotion**, that eligibility must be permanently recorded according to the business rule.

Create a durable promotion redemption/eligibility record.

The record must survive order deletion.

Do not physically delete historical promotion redemption records merely because the related order is deleted.

If an order is cancelled/refunded, handle the promotion according to an explicit promotion policy rather than silently restoring eligibility.

The default safe behavior should be:

> First-order promotional eligibility is consumed once the qualifying order is successfully placed.

Make this behavior explicit in the data model and business logic.

---

# 8. TYPE E — COUPON CODES

Support owner-created coupon codes.

Examples:

- SUMMER50
- CAKE20
- FIRST100
- CUPCAKE150

Owner should configure:

- Coupon code
- Discount type
- Percentage/fixed amount
- Eligible products
- Eligible categories
- Eligible product groups
- Minimum order amount
- Maximum discount
- Start/end date
- Global usage limit
- Per-customer usage limit
- First-order-only restriction
- Active/inactive status

Coupon codes must be:

- Case-normalized
- Unambiguous
- Uniquely indexed
- Securely validated
- Server-side validated

Do not rely on frontend validation.

---

# 9. FUTURE-PROOF PROMOTION MODEL

Design the database so additional promotion types can be introduced later.

Avoid creating a giant table with dozens of nullable columns where possible.

Use a clean promotion + configuration/rules architecture.

Possible conceptual structure:

- Promotions
- Promotion rules
- Promotion targets
- Promotion rewards
- Promotion coupons
- Promotion redemptions
- Promotion usage
- Promotion banners
- Promotion events/audit history

Use appropriate foreign keys, constraints and indexes.

The exact schema should follow the existing project's architecture rather than blindly copying these names.

---

# 10. OFFER TARGETING

Offers must support targeting by:

### Store

Entire store.

### Category

One or multiple categories.

### Product

One or multiple products.

### Product group

One or multiple explicitly selected products.

### Customer

Where required:

- Everyone
- First-time customers
- Specific eligibility rules

Avoid storing duplicated product/category information inside promotions.

Use relationships to the existing product/category records.

---

# 11. OFFER PRIORITY AND STACKING

This is critical.

Define deterministic rules for multiple simultaneous promotions.

The engine must never randomly apply discounts.

Implement explicit promotion evaluation behavior.

Support concepts such as:

- Promotion priority
- Exclusive promotions
- Stackable promotions
- Coupon + automatic promotion
- Maximum number of promotions per order

A safe initial policy may be:

1. Validate all eligible automatic promotions.
2. Evaluate coupon eligibility.
3. Apply only promotions allowed by the configured stacking rules.
4. Never allow discounts to produce a negative subtotal.
5. Never double-discount the same item unintentionally.

Do NOT assume that every eligible promotion should stack.

Make stacking behavior explicit in the data model.

If the owner creates conflicting promotions, the engine must resolve them deterministically.

Document the exact rules.

---

# 12. DISCOUNT CALCULATION ENGINE

Create one authoritative promotion calculation service.

It should receive the normalized cart/order context and return a complete pricing breakdown.

Conceptually:

- Original subtotal
- Eligible items
- Promotion discounts
- Coupon discount
- Total discount
- Final subtotal
- Any applicable taxes/fees if already supported
- Final payable amount

Never trust:

- Client subtotal
- Client discount
- Client final amount
- Client coupon validation
- Client promotion eligibility

The server must recalculate everything.

Use integer-safe monetary calculations appropriate for INR.

Avoid floating-point currency errors.

Apply deterministic rounding rules.

Document rounding behavior.

---

# 13. CART BEHAVIOR

Promotions must be reflected in the cart.

Customers should see:

- Original price
- Applied offer
- Discount amount
- Final price
- Coupon code if applicable
- Promotion explanation where useful

If cart contents change:

- Recalculate promotions.
- Revalidate coupon.
- Revalidate eligibility.
- Remove invalid promotions automatically.
- Never retain stale discounts.

Examples:

Customer qualifies for:

> Any 4 cupcakes for ₹299

Then removes one cupcake.

The bundle must immediately stop applying if only three eligible products remain.

---

# 14. CHECKOUT / ORDER INTEGRATION

Integrate Phase 5 with the existing Phase 4 checkout/order flow.

At order creation:

1. Load authoritative product data.
2. Load current cart/order configuration.
3. Validate inventory/availability where applicable.
4. Validate promotion.
5. Validate coupon.
6. Validate first-order eligibility.
7. Recalculate all prices.
8. Recalculate discount.
9. Calculate final amount.
10. Persist the final order snapshot.
11. Persist applied promotion details.
12. Persist promotion redemption/usage atomically.
13. Create order events/notifications as already implemented.

The order must contain enough historical information to show:

- Original item price
- Applied promotion
- Discount
- Coupon
- Final item/order price

Future edits to the promotion must NOT alter historical orders.

---

# 15. CONCURRENCY / RACE CONDITIONS

Handle concurrent redemption correctly.

Example:

Promotion allows:

> First 100 customers only

Customer A and Customer B submit orders simultaneously near redemption #100.

The database must prevent exceeding the usage limit.

Use appropriate:

- Transactions
- Row-level locking where required
- Atomic updates
- Unique constraints
- Idempotency

Do not rely on:

> SELECT count(*) → then INSERT

without protecting the race condition.

---

# 16. USAGE LIMITS

Support:

### Global limit

Example:

> First 100 redemptions

### Per-customer limit

Example:

> Maximum 1 use per customer

### Per-order limit

Prevent repeated coupon application within the same order.

Track actual redemption state.

Do not calculate historical usage solely from currently visible orders.

Cancelled/deleted orders must follow explicit redemption policy.

---

# 17. ORDER DELETION / CANCELLATION / REFUND

This is a critical security/business rule.

Promotion redemption records must not simply disappear when an order is deleted.

Define promotion lifecycle behavior for:

- Order placed
- Order cancelled
- Owner cancels order
- Customer cancellation if supported
- Order marked done
- Refund
- Order deletion
- Administrative cleanup

Historical promotion usage must remain auditable.

Deleting an order should NOT allow customers to repeatedly exploit a first-order coupon.

Never restore first-order eligibility simply because an order no longer exists.

---

# 18. OWNER OFFER BANNERS

Every offer should support customer-facing marketing content.

Owner can configure:

### Header

Example:

> SUMMER SPECIAL

### Title

Example:

> Any 2 Cupcakes for ₹150

### Description

Explain the offer.

### CTA

Optional.

Examples:

- Shop Now
- Explore Cupcakes
- Get Offer

### Banner image

Owner should be able to choose:

1. One of 5–10 predefined server-stored banner images.
2. An image from the existing gallery/storage system.

Do not create duplicate storage systems if Supabase Storage already exists.

Validate:

- File type
- File size
- Upload authorization
- Storage path ownership
- Unsafe filenames
- Invalid URLs

---

# 19. CUSTOMER HERO/OFFER CAROUSEL

Active promotional offers should appear on the customer web store hero/offer carousel.

Only offers that are:

- Active
- Within their validity period
- Published
- Not archived

should appear.

Do not show expired or paused offers.

The carousel should use the offer's:

- Banner
- Header
- Title
- Description
- CTA

---

# 20. OFFER CLICK DESTINATION

Every offer should have an explicit destination.

Examples:

### Product offer

> 20% OFF Red Velvet Cake

Click → Red Velvet Cake product page.

### Category offer

> 30% OFF Cupcakes

Click → Cupcakes category.

### Mix & Match

> Any 2 Cupcakes for ₹150

Click → Cupcakes/category page filtered to eligible products if appropriate.

### Store-wide offer

Click → Store/product listing.

### Product-group offer

Click → appropriate product listing/group destination.

Never hardcode promotional routing.

Store the destination/reference safely and resolve it through the application's existing routing architecture.

Do not allow owner-entered arbitrary dangerous redirect URLs.

---

# 21. EXPIRED OFFER BEHAVIOR

When an offer expires:

- Stop applying it to new carts/orders.
- Remove it from customer-facing active banners.
- Existing historical orders remain unchanged.
- Existing carts must be revalidated.
- Coupon codes must stop working.
- Scheduled offers should activate automatically when their start time is reached.

Do not require manual owner intervention for expiration.

---

# 22. TIMEZONE

The store operates in India.

Use a consistent timezone strategy.

Do not compare browser-local times against database timestamps incorrectly.

Store timestamps consistently and convert for display.

Promotion start/end boundaries must be deterministic.

Document the timezone behavior.

---

# 23. SECURITY / RLS

Implement strict Supabase RLS.

Customers:

- Can only see promotions that are publicly active/published.
- Can only see their own coupon/redemption information where appropriate.
- Cannot modify promotions.
- Cannot modify redemption records.
- Cannot manipulate discount amounts.

Owners:

- Can create/update/pause/archive/delete promotions according to owner authorization.
- Cannot bypass server-side pricing.
- Cannot access another user's private promotion/redemption data unless explicitly authorized by the application.

Protect against:

- IDOR
- Privilege escalation
- Coupon enumeration
- Unauthorized promotion editing
- Unauthorized banner manipulation
- Price manipulation
- Discount manipulation
- First-order abuse
- Replay attacks
- Duplicate redemption
- Race conditions

---

# 24. COUPON ENUMERATION PROTECTION

Do not expose unnecessary information through coupon validation.

For invalid codes, avoid leaking internal information such as:

- Whether a code exists but is inactive
- Usage counts
- Private targeting rules
- Internal promotion IDs

Return appropriate customer-facing messages without exposing sensitive internal details.

---

# 25. AUDIT HISTORY

Owner promotion changes should be auditable.

Track important events such as:

- Promotion created
- Promotion edited
- Promotion activated
- Promotion paused
- Promotion archived
- Coupon changed
- Eligibility changed
- Banner changed
- Promotion deleted

Do not silently overwrite important business history.

Follow the existing audit/event architecture where available.

---

# 26. OWNER UI/UX

The owner Offers page must feel like a professional management dashboard.

Include:

- Offer cards/table
- Status badges
- Search
- Filters
- Create offer
- Edit
- Duplicate
- Pause/resume
- Archive/delete
- Usage information
- Validity dates
- Preview

Offer creation should use a guided form.

The UI should dynamically display only fields relevant to the selected promotion type.

Example:

Selecting:

> Percentage Off

shows percentage/max discount/targeting.

Selecting:

> Buy X Get Y

shows trigger/reward configuration.

Selecting:

> Any N for ₹X

shows bundle quantity/bundle price/eligible products.

Avoid overwhelming the owner with irrelevant fields.

---

# 27. CUSTOMER UI

Customers should clearly understand:

- What the offer is
- What qualifies
- What discount they receive
- Which products/categories are eligible
- Minimum order if applicable
- Expiration if relevant
- Coupon requirements

Do not show misleading discounts.

If an offer cannot currently be applied, do not display it as though it is active.

---

# 28. PRODUCT / CATEGORY DELETION EDGE CASES

Products and categories may be edited or removed after a promotion has been created.

Do not allow dangling promotion references.

Define safe behavior when:

- Product is deleted
- Category is deleted
- Product becomes inactive
- Product becomes unavailable
- Category changes
- Product moves category

Historical orders must remain unchanged.

Existing promotions should either:

- Automatically exclude unavailable targets, or
- Become invalid/inactive where required

according to clearly defined business rules.

Never silently redirect a promotion to an unrelated product.

---

# 29. PROMOTION VALIDATION

Create centralized validation rules.

Examples:

- Percentage must be valid.
- Fixed discount cannot be negative.
- Maximum discount cannot be negative.
- Minimum order cannot be negative.
- Buy quantity must be > 0.
- Reward quantity must be > 0.
- Bundle quantity must be > 0.
- Bundle price cannot be negative.
- End date must be after start date.
- Coupon code must meet normalization requirements.
- Promotion must have valid targets when target scope requires them.
- First-order promotions cannot be configured in contradictory ways.

Reject invalid configurations before saving.

---

# 30. IDEMPOTENCY

Promotion application and redemption must be idempotent.

If the customer submits checkout twice because of:

- Network retry
- Browser retry
- Double-click
- Request timeout

the system must not:

- Create duplicate orders
- Consume the same promotion twice
- Increment coupon usage twice
- Consume first-order eligibility twice

Integrate with the existing Phase 4 order idempotency mechanism.

---

# 31. PERFORMANCE

Do not run expensive promotion queries repeatedly for every product.

Use appropriate:

- Indexes
- Batched queries
- Target relationships
- Cached public promotion data where appropriate

But never cache security-sensitive eligibility in a way that can produce incorrect authorization.

Promotion calculation must remain correct before optimization.

---

# 32. TESTING

Do not rely only on manual testing.

Create appropriate unit/integration tests for the promotion engine.

At minimum test:

### Percentage

- Store-wide
- Category
- Product
- Product group
- Minimum order
- Maximum discount

### BOGO

- Buy 1 get 1
- Buy 2 get 1
- Repeated qualification
- Partial qualification
- Free/discounted reward calculation

### Mix & Match

- Exact quantity
- Less than required
- Multiple bundles
- Mixed products
- Ineligible products

### Coupons

- Valid
- Invalid
- Expired
- Not started
- Usage limit
- Per-user limit
- Minimum order
- Wrong target
- First-order restriction

### First order

Test the abuse case explicitly:

1. Customer has never ordered.
2. Customer uses first-order promotion.
3. Order is successfully created.
4. Customer deletes/cancels order.
5. Owner deletes/cancels order where supported.
6. Customer attempts to use first-order promotion again.

The customer must NOT regain eligibility merely because the order disappeared.

### Concurrency

Test redemption limits under concurrent requests.

### Security

Test unauthorized promotion modification and unauthorized order/customer access.

---

# 33. DATABASE MIGRATION SAFETY

Create proper Supabase migrations.

Do not manually modify production schema without migration history.

Include:

- Tables
- Foreign keys
- Constraints
- Indexes
- RLS
- Policies
- Functions/triggers where appropriate

Ensure migrations are repeatable and safe.

Do not destroy existing Phase 1–4 data.

---

# 34. DOCUMENTATION

Document:

- Promotion types
- Database architecture
- Eligibility rules
- Discount calculation
- Stacking rules
- Coupon behavior
- First-order behavior
- Order cancellation/deletion behavior
- Redemption lifecycle
- Timezone
- Banner routing
- Security/RLS
- Testing strategy

Clearly document the rule:

> Deleting/cancelling an order does not automatically restore first-order promotional eligibility once the promotion has been consumed.

---

# 35. DO NOT IMPLEMENT THESE YET

Do not introduce unrelated functionality.

Do not implement:

- Online payment gateways
- Loyalty points
- Referral systems
- Subscription discounts
- Complex customer segmentation
- Marketing automation

Design the promotion engine so these could be added later, but keep Phase 5 focused.

---

# 36. ACCEPTANCE CRITERIA

Phase 5 is complete only when:

### Owner

- Can create promotions.
- Can edit promotions.
- Can pause/resume promotions.
- Can schedule promotions.
- Can archive/delete promotions.
- Can configure percentage discounts.
- Can configure BOGO.
- Can configure Buy X Get Y.
- Can configure Mix & Match.
- Can configure first-order promotions.
- Can configure coupon codes.
- Can target store/category/product/product group.
- Can configure minimum order.
- Can configure maximum discount.
- Can configure usage limits.
- Can configure customer-facing banner content.
- Can select predefined or gallery banner images.
- Can configure destination.

### Customer

- Sees valid active offers.
- Sees correct offer banners.
- Clicking banners goes to the correct destination.
- Cart correctly reflects eligible promotions.
- Coupon validation works.
- First-order validation works.
- Checkout recalculates discounts server-side.
- Final order contains immutable discount snapshots.
- Invalid/expired promotions cannot be exploited.

### Security

- RLS is enforced.
- Client cannot manipulate final price.
- Client cannot manipulate discount.
- Client cannot bypass first-order restrictions.
- Coupon usage limits cannot be bypassed.
- Deleted/cancelled orders cannot restore first-order eligibility.
- Concurrent requests cannot exceed promotion limits.
- Historical orders remain financially immutable.

### Engineering

- Typecheck passes.
- Lint passes.
- Formatter passes.
- Relevant unit/integration tests pass.
- Production build passes.
- No unrelated Phase 1–4 regressions.
- Database migrations are clean.
- Documentation is updated.

---

# FINAL INSTRUCTION

Think through the complete promotion lifecycle before writing code.

Do not rush into UI implementation.

First design the data model and business rules.

Then implement the server-side promotion engine.

Then integrate it with cart/checkout/order creation.

Then implement owner management.

Then implement customer-facing banners and promotion displays.

Then implement tests.

Then run normal engineering verification.

The promotion engine must have **one authoritative calculation path**.

Never implement separate discount calculations for:

- Product page
- Cart
- Checkout
- Order creation
- Owner order page

They must all rely on the same authoritative business logic.

Do not trust the client.

Do not create shortcuts.

Do not use hardcoded promotion logic for individual offers.

Build this as a reusable promotion engine that can support the bakery's future growth without requiring a rewrite.

Most importantly: **correctness, security, financial integrity and abuse prevention take priority over speed of implementation.**
