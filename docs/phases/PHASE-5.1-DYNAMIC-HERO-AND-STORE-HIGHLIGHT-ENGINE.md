# Phase 5 Add-On — Dynamic Hero & Store Highlights Engine

## OBJECTIVE

Extend the existing Phase 5 implementation with a production-grade **Dynamic Hero / Store Highlights Engine**.

The customer homepage hero carousel must NOT depend exclusively on active offers.

The system must always provide meaningful hero content, even when:

- There are no offers.
- There are no active campaigns.
- No products are manually featured.
- Products have expired.
- An offer becomes inactive.
- A featured product is deleted or disabled.

The carousel should be treated as a reusable merchandising/content system where offers are only one possible content type.

Do not create a separate disconnected system for offers.

Integrate this cleanly with the existing Phase 1–5 architecture.

---

# 1. FIRST: UNDERSTAND THE EXISTING SYSTEM

Before changing anything:

- Read the complete existing codebase.
- Use Graphify to understand the current architecture.
- Inspect the Phase 1–5 implementation.
- Inspect the existing products/categories schema.
- Inspect the offer/promotion schema created in Phase 5.
- Inspect Supabase Storage.
- Inspect owner authorization/RLS.
- Inspect customer-side routing.
- Inspect existing homepage/store components.
- Inspect existing product creation/editing forms.
- Inspect existing store settings.
- Inspect existing design system.

Do not duplicate existing functionality.

Do not create a second product system.

Do not create a second category system.

Do not create a second offer system.

Do not create a second image storage system.

Reuse the existing architecture wherever possible.

---

# 2. CORE CONCEPT

Create a generic concept:

**Hero Item / Store Highlight**

A Hero Item can represent:

1. Offer
2. Featured Product
3. New Product
4. Category
5. Announcement
6. Custom Campaign
7. Default System Slide

The customer carousel should consume these items through one unified rendering system.

Do not hardcode separate carousel logic for each content type.

---

# 3. THREE DEFAULT SYSTEM SLIDES

The store must have three evergreen fallback slides.

### DEFAULT 1 — Freshly Baked, Made for You

Headline:

> Freshly Baked, Made for You

Supporting text:

> Cakes, cupcakes, brownies, cookies and more, freshly prepared for every occasion.

CTA:

> Explore Menu

Destination:

> Shop All Products

---

### DEFAULT 2 — Make It Yours

Headline:

> Make It Yours

Supporting text:

> Customize your cake with your preferred flavour, size and design.

CTA:

> Customize Your Cake

Destination:

> Existing customizable-product/category experience

---

### DEFAULT 3 — Order Today, Pick Up Fresh

Headline:

> Order Today, Pick Up Fresh

Supporting text:

> Choose your favourites, select your pickup date and collect your order fresh from the store.

CTA:

> Order Now

Destination:

> Shop All Products

These defaults should be built into the system as controlled system content rather than hardcoded directly inside the homepage component.

The owner should be able to:

- Enable/disable each default slide.
- Change its ordering.
- Preview it.

However, the application must never render an empty hero area.

If the owner disables all defaults and there is no active customer content, render a safe system fallback.

---

# 4. OWNER HERO MANAGEMENT

Create:

**Owner → Store → Hero Carousel / Store Highlights**

The owner must be able to:

- View all hero items.
- Create hero item.
- Edit hero item.
- Duplicate hero item.
- Enable/disable hero item.
- Schedule hero item.
- Reorder hero items.
- Set priority.
- Preview hero item.
- Archive hero item.
- Delete hero item where safe.

Use a professional dashboard UI.

Clearly show:

- Type
- Title
- Status
- Start date
- End date
- Priority
- Destination
- Source object
- Preview

---

# 5. HERO ITEM TYPES

## A. OFFER

Allow an existing Phase 5 promotion to be featured.

Do not duplicate offer data.

Reference the existing promotion.

If the promotion becomes:

- Expired
- Paused
- Archived
- Deleted

the hero item must automatically stop displaying it.

Never display an expired offer as active.

---

## B. FEATURED PRODUCT

Allow an existing product to be promoted.

The hero item should reference the product rather than copying its entire data.

Clicking the slide must open the correct product page.

If the product is deleted/inactive/unavailable, the hero item must stop being displayed or safely fall back.

---

## C. NEW PRODUCT

Add a product-level option:

> Mark as New

When enabled, the product becomes eligible for automatic “New Arrival” merchandising.

Also provide:

> Feature this product in Hero Carousel

These are separate concepts.

A product can be new without being featured.

A product can be featured without being new.

---

# 6. ADD PRODUCT INTEGRATION

Modify the existing Add/Edit Product UI.

Add a merchandising section:

### Store Visibility & Promotion

Options:

- Mark as New
- Feature in Hero Carousel

If **Mark as New** is enabled:

Allow:

- New duration
- Default duration configured by the system
- Optional custom start/end

If **Feature in Hero Carousel** is enabled:

Allow:

- Hero title
- Hero description
- Banner image
- CTA text
- Priority
- Start/end date
- Enabled/disabled

Provide sensible automatically generated defaults.

Example:

> New Arrival  
> [Product Name]  
> Discover our latest addition.  
> Explore Now

The owner can customize these values.

---

# 7. CATEGORY HIGHLIGHTS

Allow the owner to create:

> Featured Category

Examples:

- Explore Our Cupcakes
- Birthday Cakes
- Chocolate Collection
- Brownies

The hero should link to the existing category page.

Do not create duplicate category references.

If the category is deleted or unavailable, the hero item should no longer be active.

---

# 8. OWNER ANNOUNCEMENTS

Allow the owner to create a simple announcement without creating a promotion.

Examples:

> Custom Cakes Now Available

> New Weekend Collection

> Pre-order Your Birthday Cake

> New Pickup Timing

Fields:

- Headline
- Description
- Banner image
- CTA
- Destination
- Start date
- End date
- Priority
- Enabled

This is marketing content, not a discount.

---

# 9. CUSTOM CAMPAIGN

Allow an owner to create a general-purpose campaign slide.

A campaign can reference:

- Product
- Category
- Offer
- Product group
- Internal store page

Avoid arbitrary external redirects.

This gives the owner flexibility without requiring developer changes.

---

# 10. HERO IMAGE SYSTEM

Reuse the existing Supabase Storage architecture.

Support:

- Existing gallery images
- Predefined system banner images
- Uploaded campaign images

Validate:

- File type
- File size
- Ownership
- Storage path
- Image dimensions where appropriate

Do not create a second image-storage system.

---

# 11. RESPONSIVE IMAGE SUPPORT

Hero images must work properly on:

- Desktop
- Tablet
- Mobile

If the existing architecture supports separate desktop/mobile images, use them.

Otherwise implement safe responsive cropping.

Important visual content must not accidentally be cropped on mobile.

Provide an owner preview for both desktop and mobile.

---

# 12. CTA SYSTEM

Every non-system hero item may have:

- CTA label
- Internal destination

Examples:

- Shop Now
- Order Now
- Explore
- View Product
- View Category
- Customize Now
- Get Offer

Destinations should be represented structurally.

Do not allow unsafe arbitrary redirects.

Validate that referenced:

- Product
- Category
- Offer
- Campaign

still exists and is available.

---

# 13. SCHEDULING

Every hero item should optionally support:

- Start date/time
- End date/time

Lifecycle:

```text
Draft
  ↓
Scheduled
  ↓
Active
  ↓
Expired
  ↓
Archived
```

The system should determine active state from authoritative timestamps.

Do not require an owner to manually activate/expire every campaign.

Use the application's established timezone strategy.

---

# 14. PRIORITY AND ORDER

Support both:

### Manual ordering

Owner can drag and reorder hero items.

### Priority

Owner can assign priority.

Define deterministic behavior when both are present.

Do not randomly select slides.

---

# 15. AUTOMATIC HERO SELECTION

Implement a deterministic selection engine.

Conceptually:

```text
Active owner campaigns/offers
        ↓
Featured products
        ↓
New products
        ↓
Category highlights
        ↓
Announcements
        ↓
Default system slides
```

Select an appropriate number of slides for the carousel.

Do not show every available item.

Avoid flooding the homepage.

The exact selection limit should be configurable.

---

# 16. FALLBACK BEHAVIOR

This is mandatory.

### Scenario A

There are 5 active offers.

Show appropriate active promotional content.

### Scenario B

There are no offers but 3 featured products.

Show featured products plus suitable defaults if additional slides are required.

### Scenario C

There are no offers and no featured products.

Show:

- Default 1
- Default 2
- Default 3

### Scenario D

Owner disables defaults.

If no other content exists, show a safe minimal system fallback.

Never render:

- Empty carousel
- Broken image
- “No offers available”
- Empty white/blank hero section

The customer homepage must always look intentional.

---

# 17. AUTOMATIC NEW PRODUCT CONTENT

When a product is marked as New:

- It becomes eligible for new-product merchandising.
- It must not automatically create unlimited duplicate hero records.
- Existing hero records must remain consistent.
- Expired “new” state must automatically stop qualifying.

If a product is manually featured, that feature should remain independently controlled.

---

# 18. OFFER INTEGRATION

Phase 5 offers must integrate with the carousel.

An owner should be able to select:

> Feature this offer in Hero Carousel

The system must reference the existing offer.

Do not duplicate:

- Discount rules
- Coupon rules
- Offer dates
- Promotion configuration

The promotion engine remains authoritative.

---

# 19. OWNER PREVIEW

Implement a preview system.

Owner should be able to preview:

- Desktop
- Mobile
- Slide image
- Headline
- Description
- CTA
- Destination

Preview should not accidentally create a published campaign.

---

# 20. CONFLICT HANDLING

The system must handle:

- Deleted products
- Disabled products
- Deleted categories
- Expired offers
- Paused offers
- Archived offers
- Missing images
- Expired campaigns
- Invalid references

Never display broken content.

Never show a CTA pointing to an invalid destination.

Automatically exclude invalid content from customer-facing selection.

---

# 21. CUSTOMER EXPERIENCE

The customer carousel should:

- Look premium and calm.
- Match the bakery's existing design system.
- Support touch swipe.
- Support desktop navigation.
- Support autoplay where appropriate.
- Pause/avoid aggressive movement during interaction.
- Support reduced-motion preferences.
- Be accessible.
- Have proper semantic labels.
- Not cause layout shifts.
- Load efficiently.

Do not over-animate the carousel.

The bakery aesthetic should remain cozy, elegant and premium rather than flashy.

---

# 22. PERFORMANCE

Do not query every product, category and offer independently on every homepage render.

Use appropriate:

- Server-side queries
- Batched queries
- Existing caching strategy
- Indexed database relationships
- Optimized image delivery

Only fetch the content necessary to construct the active carousel.

Do not compromise correctness for caching.

Expired/inactive promotions must never remain visible because of stale cache beyond an acceptable defined policy.

---

# 23. SECURITY

Apply strict RLS.

Customers must only receive public active hero content.

Owners must only manage content they are authorized to manage.

Prevent:

- IDOR
- Unauthorized hero modification
- Unauthorized product promotion
- Unauthorized offer promotion
- Arbitrary redirect injection
- Unauthorized image access
- Privilege escalation

All owner mutations must be server-authorized.

Never trust client-provided:

- Product status
- Offer status
- Destination
- Ownership
- Publish state

---

# 24. ANALYTICS-READY ARCHITECTURE

Do not build a large analytics platform in this phase.

However, design the system so future tracking can support:

- Hero impressions
- Hero clicks
- CTA clicks
- Product conversions
- Offer conversions

Do not block the implementation waiting for analytics.

---

# 25. DATABASE DESIGN

Use the existing database architecture.

Create a reusable hero/store-highlight representation rather than storing separate unrelated fields for every source type.

Use references to:

- Products
- Categories
- Promotions
- Campaigns

where appropriate.

Use:

- Foreign keys
- Constraints
- Indexes
- RLS
- Appropriate uniqueness constraints

Do not duplicate product names/prices/images unnecessarily.

Historical campaign/hero content should remain safe even when source objects change.

---

# 26. TESTING

Create unit/integration tests for:

- Active hero selection
- Expired hero exclusion
- Scheduled hero behavior
- Offer integration
- Product integration
- Category integration
- Announcement integration
- New-product behavior
- Disabled defaults
- Empty-state fallback
- Deleted product handling
- Deleted category handling
- Expired offer handling
- Invalid destination handling
- Owner authorization
- Customer visibility
- RLS
- Priority/order logic

Especially test:

> No active offers + no featured products + no announcements

Expected:

> Default carousel appears.

And:

> All defaults disabled + no active content

Expected:

> Safe minimal system fallback appears.

---

# 27. DOCUMENTATION

Update project documentation with:

- Hero architecture
- Hero item types
- Selection priority
- Fallback behavior
- Product merchandising behavior
- Offer integration
- Scheduling
- Routing
- Image handling
- Security/RLS
- Testing strategy

---

# 28. DO NOT

Do not:

- Create a second offer engine.
- Create a second product system.
- Create a second category system.
- Create a second storage system.
- Hardcode offers into the homepage.
- Hardcode product IDs.
- Hardcode category IDs.
- Trust client-side promotion state.
- Allow arbitrary external redirects.
- Render an empty hero section.
- Automatically feature every new product.
- Flood the carousel with dozens of slides.
- Add unrelated functionality.

---

# 29. ACCEPTANCE CRITERIA

Phase 5 Add-On is complete when:

- The carousel is independent of the offer system while integrating with it.
- Three default slides exist.
- The customer homepage never has an empty hero area.
- Owner can manage hero content.
- Owner can promote products.
- Owner can mark products as new.
- Owner can promote categories.
- Owner can create announcements.
- Owner can feature offers.
- Owner can schedule content.
- Owner can enable/disable content.
- Owner can reorder content.
- Owner can preview content.
- Invalid source content is automatically excluded.
- CTA destinations are safe and validated.
- Mobile and desktop presentation works correctly.
- RLS/security is enforced.
- Existing Phase 1–5 functionality is not broken.
- Typecheck passes.
- Lint passes.
- Formatting passes.
- Production build passes.
- Relevant unit/integration tests pass.

Do not spend time on full E2E testing; manual E2E testing will be performed separately.

---

# FINAL ENGINEERING PRINCIPLE

Treat the Hero Carousel as a **dynamic merchandising platform**, not merely an offer banner.

Offers, products, new arrivals, categories and announcements should all be interchangeable content sources.

The customer should always see something useful.

The owner should have complete control.

The system should automatically handle scheduling, expiration, fallback and invalid content.

Keep the implementation modular so future content types can be added without rewriting the carousel.

Prioritize correctness, maintainability, security, performance and excellent UX over implementation speed.
