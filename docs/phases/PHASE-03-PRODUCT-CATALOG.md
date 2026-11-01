# BAKE N TAKE — PHASE 3

## Production Product & Category Management System

## ROLE

Continue working as a senior staff-level:

- Full-stack engineer
- Frontend engineer
- Backend engineer
- PostgreSQL/Supabase architect
- UI/UX designer
- Security engineer
- QA engineer
- DevOps engineer
- Performance engineer
- Technical documentation engineer

Phase 1 — Authentication and Phase 2 — Centralized Store Settings have already been completed successfully.

Treat both phases as stable foundations.

**Do not break, rewrite, or unnecessarily refactor Phase 1 or Phase 2.**

---

# 1. PHASE 3 OBJECTIVE

Build the complete **product and category management foundation** for the bakery.

The owner must be able to:

- Create products
- Edit products
- Delete/archive products
- Upload product images
- Manage product pricing
- Assign products to categories
- Configure product variants
- Configure cake sizes
- Configure batch/quantity options
- Configure flavours
- Configure additional flavour charges
- Configure other customization options
- Enable/disable customer-uploaded custom designs
- Control product availability
- Mark products as featured/trending
- Manage product display order
- Create categories
- Edit categories
- Archive/delete categories safely

Customers must be able to see the same real product data on the storefront.

The system must have **one authoritative source of truth in Supabase**.

---

# 2. IMPORTANT SCOPE BOUNDARY

This phase is ONLY about:

**Products + Categories + Product customization + Product media + Customer product presentation**

Do NOT implement:

- Cart
- Checkout
- Orders
- Payments
- Coupons
- Promotions/offers
- Order scheduling
- Delivery
- WhatsApp ordering
- Order tracking
- Customer order history

Those belong to future phases.

However, design the product architecture so those future systems can consume it without requiring a major rewrite.

---

# 3. FIRST STEP — FULL CODEBASE AUDIT

Before writing code:

Inspect the entire repository.

Understand:

- Existing Next.js architecture
- Existing Supabase architecture
- Authentication
- Authorization
- RLS
- Store Settings implementation
- Storage buckets
- UI component system
- shadcn/ui configuration
- Existing data-access patterns
- Existing caching/revalidation
- Testing infrastructure
- CI/CD
- Documentation

Then perform a repository-wide search for existing:

- Dummy products
- Static product arrays
- Placeholder product images
- Hardcoded categories
- Mock product APIs
- Fake product data
- Product cards using static data
- Product detail pages using static data
- Product-related TypeScript types
- Existing unused product schemas

Do not blindly replace existing code.

Understand how Phase 1 and Phase 2 were implemented and extend the existing architecture consistently.

---

# 4. REMOVE ALL STATIC PRODUCT DATA

Before connecting the real product system:

Remove production-facing hardcoded product/category data.

There must be no static source of truth for:

- Product name
- Product image
- Product price
- Product description
- Category
- Flavours
- Sizes
- Quantity/batch options
- Product availability

The customer storefront must eventually read these values from Supabase.

Demo/test fixtures may remain only if they are clearly isolated from production application data.

---

# 5. PRODUCT ARCHITECTURE

Do NOT create a single giant `products` table containing every possible customization as random JSON unless there is a strong architectural reason.

Design a normalized and extensible relational model.

The system should conceptually support:

```text
Product
 ├── Category
 ├── Images
 ├── Variants
 │    ├── Size / Weight
 │    └── Batch / Quantity
 ├── Flavours
 ├── Customization Options
 └── Custom Design Configuration
```

Keep product core information separate from configurable options.

Use JSON/JSONB only where it genuinely improves flexibility and does not undermine data integrity.

---

# 6. PRODUCT CORE DATA

Each product should support at minimum:

- Internal ID
- Public-safe identifier/slug
- Product name
- Short description
- Full description
- Base price where applicable
- Category
- Product type
- Availability status
- Featured status
- Trending status
- Custom-design enabled
- Display order
- Created timestamp
- Updated timestamp

Avoid exposing internal database IDs unnecessarily in customer-facing URLs.

Use a clean public product slug or opaque public identifier.

Example:

`/products/chocolate-truffle-cake`

rather than exposing database implementation details.

---

# 7. PRODUCT TYPE

Introduce a product type system so the architecture is not hardcoded specifically around cakes.

At minimum support concepts such as:

- Cake
- Cupcake
- Brownie
- Cookie
- Pastry
- Other

The owner should be able to select the product type.

Design this so new product types can be added later without database redesign.

---

# 8. CATEGORY SYSTEM

Create a complete category management system.

Owner must be able to:

### Create category

Configure:

- Category name
- Description
- Image if useful
- Display order
- Active/inactive status

### Edit category

Change category information.

### Archive/delete category

Handle deletion safely.

---

# 9. CATEGORY DELETE SAFETY

Do NOT blindly delete categories that contain products.

Before deletion:

- Check whether products are assigned to the category.

If products exist:

Prefer one of:

- Prevent deletion and explain why.
- Require reassignment to another category.
- Archive the category instead.

Do not create orphaned products.

Do not silently delete products because a category was deleted.

---

# 10. CATEGORY SLUGS

Generate clean unique category slugs.

Example:

```text
birthday-cakes
cupcakes
brownies
cookies
```

Handle duplicate names safely.

Do not allow duplicate active slugs.

---

# 11. PRODUCT SLUGS

Generate a customer-friendly unique slug for each product.

Example:

```text
chocolate-truffle-cake
red-velvet-cake
chocolate-cupcake
```

If the product name changes:

Do not blindly break existing public URLs.

Design the slug system so future redirect/history support can be added.

---

# 12. PRODUCT IMAGES

Use Supabase Storage.

The owner must be able to:

- Upload product images
- Replace images
- Delete images
- Reorder images
- Select a primary image

Support multiple images per product.

The first/primary image should be used for product cards unless explicitly configured otherwise.

---

# 13. IMAGE SECURITY

Validate uploads for:

- Actual MIME type
- File size
- Image validity
- Reasonable dimensions
- Supported formats

Do not trust file extensions.

Do not allow arbitrary executable files to be uploaded.

Use secure storage paths.

Prevent one owner's uploads from accidentally overwriting another object's files.

---

# 14. PRODUCT IMAGE EXPERIENCE

The owner interface should provide:

- Drag/drop upload where appropriate
- Upload progress
- Preview
- Primary-image selection
- Reordering
- Delete confirmation
- Error handling

Do not allow the UI to display a successful upload until storage actually confirms it.

---

# 15. PRODUCT PRICING ARCHITECTURE

Design pricing carefully because future cart/order/payment phases will depend on it.

Do not treat the frontend-displayed price as authoritative.

The database must contain the authoritative pricing.

Support:

### Base price

Useful for products that have no variants.

Example:

Chocolate Brownie — ₹80

### Variant-specific price

Useful when size/quantity changes the price.

Example:

Chocolate Cake:

1 Pound → ₹600

2 Pound → ₹1,100

3 Pound → ₹1,500

---

# 16. PRODUCT VARIANTS

Create a flexible variant system.

The owner should be able to choose what kind of primary variant a product uses.

At minimum support:

### SIZE / WEIGHT

Examples:

- 500g
- 1 Pound
- 1.5 Pound
- 2 Pound
- 3 Pound
- 1kg

### QUANTITY / BATCH

Examples:

- 2 pieces
- 4 pieces
- 6 pieces
- 8 pieces
- 12 pieces

This is particularly useful for:

- Cupcakes
- Cookies
- Brownies
- Pastries

---

# 17. VARIANT MODE

Allow the owner to configure the product's purchasing option structure.

Examples:

### Cake

Variant mode:

SIZE

Options:

- 1 Pound — ₹600
- 2 Pound — ₹1,100
- 3 Pound — ₹1,500

### Cupcake

Variant mode:

QUANTITY

Options:

- 2 — ₹120
- 4 — ₹220
- 8 — ₹400

The system should not assume every product is a cake.

---

# 18. OPTIONAL MULTI-DIMENSION VARIANTS

Design the architecture so future products can support more than one dimension when required.

For example:

Cake:

Size → 1 Pound

Flavour → Chocolate

The final pricing may be:

Base size price + flavour surcharge.

Do not overcomplicate Phase 3 with a full SKU/inventory system.

But do not architect the database in a way that prevents this later.

---

# 19. VARIANT VALIDATION

Each variant must have:

- Label
- Value where useful
- Price
- Active/inactive status
- Display order

Validate:

- Positive price
- Valid quantity/size
- Unique option values within the product
- No duplicate variants

Do not allow impossible combinations.

---

# 20. FLAVOUR SYSTEM

Products may support one or multiple flavours.

The owner should be able to configure flavours for individual products.

Examples:

- Chocolate
- Vanilla
- Red Velvet
- Butterscotch
- Black Forest
- Pineapple
- Ferrero
- Custom

Do not hardcode flavour lists into the frontend.

---

# 21. FLAVOUR PRICING

Each flavour may optionally have an additional charge.

Examples:

Chocolate → +₹0

Vanilla → +₹0

Red Velvet → +₹50

Ferrero → +₹150

The owner should be able to configure:

- Flavour name
- Additional charge
- Active/inactive
- Display order

The additional charge must be stored in the database.

---

# 22. FLAVOUR PRICE CALCULATION FOUNDATION

The pricing architecture must be capable of representing:

```text
Base Variant Price
+
Flavour Additional Charge
=
Current Product Configuration Price
```

Do not implement cart/order pricing yet.

However, the product detail page should be able to calculate and display the currently selected configuration price accurately.

The server must remain the ultimate source of truth for future ordering.

---

# 23. CUSTOMIZATION OPTIONS

Create a flexible customization-option architecture.

Potential options include:

- Flavour
- Size
- Quantity
- Egg / Eggless
- Cake message
- Theme
- Colour
- Special instructions

For Phase 3, implement the options that are actually required by the current product experience.

Do not create a huge generic form-builder system unless necessary.

The architecture should allow additional options later.

---

# 24. EGG / EGGLESS

Because this is a bakery, consider supporting:

- Egg
- Eggless

as a configurable product option.

The owner should be able to enable/disable this option per product.

If an additional charge applies, allow a configurable surcharge.

Do not force every product to have this option.

---

# 25. CUSTOM DESIGN UPLOAD

Add:

**Allow Customer Custom Design**

as an owner-controlled product setting.

When disabled:

Customers cannot upload a design for that product.

When enabled:

Customers should see a customer-facing upload interface on the product detail page.

---

# 26. CUSTOMER DESIGN UPLOAD

For products where custom design is enabled, customers should be able to:

- Select/upload an image
- Preview the image
- Remove/change the image before proceeding

Since ordering is NOT implemented yet:

**Do not create an order or permanently associate the design with an order.**

For this phase, establish the product-level capability and customer UI foundation.

If the implementation persists temporary uploads, clearly separate them from future order assets and apply appropriate cleanup/security policies.

Do not create permanent orphaned customer files unnecessarily.

---

# 27. CUSTOMER UPLOAD SECURITY

Treat uploaded customer designs as untrusted files.

Validate:

- File type
- File size
- Actual image content
- Dimensions

Do not allow arbitrary file uploads.

Do not execute or render uploaded content as HTML.

Use secure storage architecture.

Do not expose private upload buckets publicly unless there is a deliberate reason.

---

# 28. PRODUCT AVAILABILITY

Owner should be able to control whether a product is:

- Active
- Unavailable
- Archived

For now:

### Active

Visible to customers.

### Unavailable

Visible but clearly marked unavailable, or hidden depending on the storefront design.

### Archived

Not shown in the normal customer catalog.

Choose one consistent UX and document it.

Do not permanently delete product records unnecessarily.

---

# 29. FEATURED / TRENDING PRODUCTS

Allow owner-controlled merchandising.

At minimum:

- Featured
- Trending
- Display order

This will allow the existing storefront's:

- Trending section
- Featured section
- Future recommendation sections

to use real database data.

Do not implement an AI recommendation engine.

---

# 30. PRODUCT DISPLAY ORDER

Allow owner to control product ordering.

Support:

- Display order number
- Drag/drop ordering where practical

Use deterministic ordering.

For example:

1. Explicit display order
2. Active status
3. Created date

Do not rely on random database ordering.

---

# 31. PRODUCT DESCRIPTION

Support:

- Short description
- Detailed description

Keep customer-facing text clean and readable.

Do not render raw HTML from owner input unless there is a properly sanitized rich-text system.

Plain text/structured content is preferred for this phase.

---

# 32. OWNER PRODUCTS PAGE

Create:

**Owner Dashboard → Products**

The page should provide:

- Product list/grid
- Search
- Category filter
- Status filter
- Product type filter
- Featured/trending filter where useful
- Add Product
- Edit
- Archive
- Delete where safe
- Quick availability toggle

Display useful information such as:

- Image
- Name
- Category
- Product type
- Starting price
- Variant count
- Availability
- Featured/trending status
- Updated date

---

# 33. ADD PRODUCT FLOW

Create a polished product creation experience.

Organize it into logical sections rather than one enormous form.

Suggested structure:

### Basic Information

- Product name
- Product type
- Category
- Short description
- Full description

### Media

- Product images
- Primary image

### Pricing / Variants

- Base price
- Variant mode
- Size/weight or quantity options

### Flavours

- Enable flavours
- Add flavours
- Additional charges

### Additional Customization

- Egg/eggless
- Other supported options

### Customer Custom Design

- Enable/disable custom design upload

### Merchandising

- Featured
- Trending
- Display order

### Availability

- Active
- Unavailable
- Archived

---

# 34. EDIT PRODUCT

Owner must be able to edit every product field.

Editing must preserve existing data correctly.

When modifying:

- Images
- Variants
- Flavours
- Options

Do not accidentally delete unrelated data.

Show appropriate confirmation when an operation is destructive.

---

# 35. DELETE / ARCHIVE PRODUCT

Prefer archival over destructive deletion.

If a product has future references:

- Do not hard-delete it.

Use archived status.

Hard deletion should only be allowed when it is safe and has no dependent records.

Design this now because future orders will reference products.

Do not build an architecture that makes historical orders impossible later.

---

# 36. CATEGORY MANAGEMENT UI

Create:

**Owner Dashboard → Categories**

Owner can:

- Create
- Edit
- Archive
- Delete when safe
- Reorder
- Activate/deactivate

Display:

- Category image where applicable
- Category name
- Product count
- Status
- Display order

---

# 37. CUSTOMER PRODUCT LISTING

Replace the existing static product data with real Supabase data.

Customer storefront should dynamically load:

- Categories
- Products
- Images
- Prices
- Variants
- Flavours
- Availability
- Featured/trending state

---

# 38. CUSTOMER PRODUCT DETAIL PAGE

Create or upgrade the product detail experience.

Display:

- Product images
- Product name
- Category
- Description
- Available variants
- Available flavours
- Additional charges
- Other customization options
- Custom design upload when enabled
- Current calculated configuration price
- Availability status

Do NOT add "Add to Cart" or checkout yet unless the existing architecture requires a disabled placeholder.

The product experience should be ready for the future ordering phase.

---

# 39. PRODUCT CONFIGURATION PRICE

When the customer selects:

- Size/weight
- Quantity
- Flavour
- Other priced options

show the calculated price.

Example:

```text
Chocolate Cake
2 Pound       ₹1,100
Ferrero       +₹150

Current price: ₹1,250
```

This is a product configuration preview only.

Do not create an order.

---

# 40. CUSTOMER UX

The customer product experience should be:

- Modern
- Premium
- Warm
- Bakery-oriented
- Easy to understand
- Mobile-first
- Fast
- Accessible

Avoid turning the product detail page into a complicated enterprise form.

Make customization feel natural.

---

# 41. PRODUCT CARD

Customer product cards should show:

- Primary image
- Product name
- Short description where appropriate
- Starting price / relevant price
- Category where useful
- Featured/trending indicator where appropriate
- Availability

Do not display misleading pricing.

If a product has variants, use language such as:

"From ₹600"

only when appropriate.

---

# 42. CUSTOMER CATEGORY NAVIGATION

Categories should be dynamically loaded.

Customers should be able to browse:

- All products
- Individual categories

Do not show categories that are inactive/archived unless intentionally required.

---

# 43. SEARCH

Add customer-side product search if the current storefront supports it or if it fits naturally into the product listing.

Search should support:

- Product name
- Category
- Relevant product terms

Do not build a complex search engine.

Use PostgreSQL capabilities appropriately.

---

# 44. FILTERING

Customer product listing should support useful filters where appropriate:

- Category
- Product type
- Availability

Avoid excessive filters in Phase 3.

---

# 45. DATABASE SECURITY

Use Supabase RLS.

### Public/customer

Allow read access only to customer-safe product/category information.

### Owner

Allow:

- Create
- Update
- Archive
- Delete where safe
- Image management
- Category management

Customers must never be able to:

- Create products
- Modify products
- Modify prices
- Modify variants
- Modify flavours
- Modify categories
- Upload owner product media
- Change product availability
- Change featured status

---

# 46. SERVER-SIDE VALIDATION

Never trust client-provided:

- Price
- Variant price
- Flavour surcharge
- Category ID
- Product ID
- Owner role
- Availability
- Product status

Validate all mutations server-side.

Verify referenced category/product records exist.

Verify the authenticated user is authorized.

---

# 47. PRICE SECURITY

All product prices stored in the database must be authoritative.

Do not allow:

```text
client says price = ₹1
```

to determine a future order price.

The customer-facing calculation is for UX.

The backend/database remains authoritative.

---

# 48. MONEY REPRESENTATION

Do not use floating-point arithmetic for monetary values.

Use an appropriate integer representation such as:

**smallest currency unit / paise**

or a database numeric/decimal strategy consistently across the application.

Choose one approach and document it.

Ensure the approach can support future:

- Discounts
- Taxes
- Payments
- Orders
- Invoices

without precision errors.

---

# 49. DATABASE RELATIONSHIPS

Establish appropriate relationships between:

```text
Categories
   ↓
Products
   ↓
Product Images
Product Variants
Product Flavours
Product Options
```

Use:

- Foreign keys
- Unique constraints
- Check constraints
- Indexes

where appropriate.

Do not leave referential integrity to application code alone.

---

# 50. PERFORMANCE

Design for a growing product catalog.

Add appropriate indexes for:

- Product slug
- Category
- Active status
- Product type
- Featured
- Trending
- Display order

Avoid N+1 queries.

Do not query every customization separately for every product card.

Use appropriate server-side joins/queries.

---

# 51. CACHING / REVALIDATION

Product data will change from the owner dashboard.

When the owner:

- Creates a product
- Updates a product
- Changes a price
- Uploads an image
- Changes a category
- Changes availability
- Changes featured/trending status

the customer storefront must receive updated data according to the application's caching/revalidation strategy.

Do not require redeployment.

---

# 52. TYPE SAFETY

Create strong TypeScript types for:

- Product
- Category
- Product image
- Product variant
- Product flavour
- Product option
- Custom design configuration

Do not use `any`.

Keep database and application types synchronized.

---

# 53. ACCESSIBILITY

Product management and storefront must support:

- Keyboard navigation
- Proper labels
- Accessible dialogs
- Focus management
- Image alt text
- Accessible upload controls
- Screen-reader-friendly status messages
- Adequate contrast
- Reduced-motion support

---

# 54. ERROR / EMPTY STATES

Implement polished states for:

### Owner

- No products
- No categories
- Upload failure
- Save failure
- Delete failure
- Validation failure

### Customer

- No products
- No category products
- Product unavailable
- Product not found
- Image unavailable
- Database temporarily unavailable

Do not display raw database errors.

---

# 55. LOADING EXPERIENCE

Use appropriate:

- Skeletons
- Loading indicators
- Optimistic UI only when safe
- Disabled buttons during mutations

Do not make the interface feel frozen.

---

# 56. TESTING

Create comprehensive tests.

### Category tests

- Create category
- Edit category
- Archive category
- Safe deletion
- Prevent deleting category with products
- Customer category visibility
- RLS

### Product tests

- Create product
- Edit product
- Archive product
- Availability
- Product images
- Variants
- Flavours
- Surcharges
- Product categories
- Featured/trending
- Slugs

### Security tests

- Customer cannot create product
- Customer cannot modify product
- Customer cannot modify price
- Customer cannot modify category
- Customer cannot upload owner product images
- Non-owner cannot perform owner mutations

### Customer tests

- Product listing
- Category filtering
- Product detail
- Variant selection
- Flavour selection
- Price calculation
- Custom design enabled
- Custom design disabled

---

# 57. END-TO-END TEST

Test this complete flow:

Owner:

Login

→ Products

→ Create Category

→ Create Product

→ Upload images

→ Select category

→ Configure size/quantity

→ Configure flavours

→ Configure flavour surcharge

→ Enable custom design

→ Save

Customer:

Storefront

→ Category appears

→ Product appears

→ Product detail opens

→ Images appear

→ Size/quantity options appear

→ Flavours appear

→ Surcharge is reflected

→ Custom design upload appears

Then:

Owner edits product

→ Customer sees updated information.

Then:

Owner disables product

→ Customer sees correct unavailable state.

Then:

Owner archives product

→ Product disappears from normal active catalog.

---

# 58. NO ORDERING

Explicitly verify that this phase does NOT create:

- Orders
- Cart records
- Checkout
- Payment transactions
- Order IDs
- Customer purchase history

The product system should only prepare the data foundation required for those future systems.

---

# 59. DOCUMENTATION

Update:

### README

Include product/category architecture.

### Architecture documentation

Document:

- Product model
- Category model
- Variant model
- Flavour model
- Storage
- RLS
- Customer read architecture
- Owner write architecture

### Owner documentation

Explain how to:

- Create category
- Create product
- Upload images
- Configure sizes
- Configure quantities
- Configure flavours
- Add flavour charges
- Enable custom designs
- Feature/trend products
- Archive products

### Developer documentation

Explain how future order/cart systems should consume product configuration and authoritative prices.

---

# 60. REGRESSION

Verify that Phase 1 and Phase 2 remain functional.

### Authentication

- Customer login
- Customer signup
- Google
- Facebook
- Logout
- Owner login
- Owner authorization

### Store Settings

- Store name
- Logo
- Address
- Phone
- Email
- Social links
- Business information

Product implementation must not break either system.

---

# 61. QUALITY CHECKS

Before completion run:

- Formatter
- ESLint
- TypeScript
- Unit tests
- Integration tests
- E2E tests
- Production build

Fix all issues.

Do not suppress errors.

Do not leave TODOs for core Phase 3 functionality.

---

# 62. FINAL SECURITY REVIEW

Review specifically for:

- RLS bypass
- Privilege escalation
- IDOR
- Price manipulation
- Unauthorized product modification
- Unauthorized category modification
- Storage abuse
- Malicious file uploads
- XSS
- Unsafe URLs
- Broken access control
- Data leakage
- Orphaned records

---

# 63. DEFINITION OF DONE

Phase 3 is complete only when:

### Owner

- Product management works.
- Category management works.
- Product image management works.
- Variants work.
- Size/weight options work.
- Quantity/batch options work.
- Flavours work.
- Flavour surcharges work.
- Customization options work.
- Custom design toggle works.
- Customer design upload foundation works.
- Product availability works.
- Featured/trending works.
- Product ordering works.
- Product archive/delete works safely.
- Category archive/delete works safely.

### Customer

- Products come from Supabase.
- Categories come from Supabase.
- Images come from Supabase Storage.
- Product details are dynamic.
- Variants are dynamic.
- Flavours are dynamic.
- Prices are dynamic.
- Configuration price preview works.
- Custom design upload appears only when enabled.
- No dummy product data remains.

### Security

- RLS works.
- Owner authorization works.
- Customers cannot mutate catalog data.
- Prices cannot be trusted from the client.
- Uploads are validated.
- Storage is secured.

### Quality

- Tests pass.
- Lint passes.
- Typecheck passes.
- Production build passes.
- Documentation is updated.
- Phase 1 remains functional.
- Phase 2 remains functional.

---

# 64. FINAL VALIDATION SCENARIO

Perform this exact final test:

1. Login as owner.
2. Create several categories.
3. Create a cake product.
4. Upload multiple cake images.
5. Configure 1 Pound and 2 Pound variants.
6. Configure multiple flavours.
7. Add different flavour surcharges.
8. Enable custom design.
9. Mark product as featured.
10. Save.

Then create a cupcake product:

1. Upload images.
2. Select Cupcake category.
3. Configure quantity options:
   - 2
   - 4
   - 8
4. Configure flavours.
5. Configure flavour charges where applicable.
6. Disable custom design.
7. Save.

Then log in as a customer.

Verify:

- Categories appear.
- Cake appears.
- Cupcake appears.
- Images work.
- Cake size options work.
- Cupcake quantity options work.
- Flavours work.
- Surcharges calculate correctly.
- Cake shows custom design upload.
- Cupcake does not show custom design upload.

Then modify the products as owner and verify the customer storefront reflects the changes.

Then archive a product and verify it disappears from the active customer catalog.

Then attempt unauthorized mutations as a customer and verify they are rejected at the database/server level.

---

# 65. FINAL ENGINEERING REPORT

When complete, provide:

## Implementation Summary

Exactly what was built.

## Database

Tables, relationships, indexes, constraints and RLS.

## Storage

Product image and customer-design storage architecture.

## Frontend

Owner product/category management and customer product experience.

## Static Data Removal

All dummy/static product and category sources removed.

## Security

Authorization, RLS, upload validation and pricing integrity.

## Testing

Actual:

- Unit test results
- Integration test results
- E2E results
- Lint result
- Typecheck result
- Build result

## Documentation

Files created/updated.

## Skills

AI skills installed and actually used.

## Manual Configuration

Anything still required in Supabase or deployment.

## Known Limitations

Only genuine limitations.

## Phase 4 Readiness

Explain whether the product foundation is ready for the future cart/order system.

---

# MOST IMPORTANT RULE

Do not build a simple CRUD product page.

Build a **production-grade product catalog foundation**.

The final architecture should be:

```text
OWNER
  ↓
Product Management
  ↓
Supabase PostgreSQL + Storage
  ↓
Product Data Layer
  ↓
Customer Storefront
  ↓
Product Detail
  ↓
Configuration Preview
```

The product database must become the **single source of truth**.

The customer must never receive hardcoded product information.

The owner must never need developer assistance to manage normal catalog content.

Design the product architecture today so that tomorrow's:

**Cart → Order → Payment → Pickup → Invoice → Notification**

systems can consume the same authoritative product data without requiring a major database rewrite.

First inspect.

Then architect.

Then implement.

Then test.

Then secure.

Then review.

Then document.

Then validate the complete owner → database → customer flow.

Do not proceed to ordering functionality during Phase 3.
