# CUSTOMER WEB STORE — COMPLETE UI/UX REDESIGN

## ROLE

Act as a **senior product designer + UI/UX designer + frontend architect + frontend engineer** working on a production bakery e-commerce platform.

You must approach this task as if this were a professional freelance client project being prepared for production.

Your priorities, in order:

1. Preserve all existing functionality.
2. Understand the existing application completely before changing anything.
3. Establish a coherent, premium visual design system.
4. Redesign every customer-facing page consistently.
5. Improve UX, responsiveness, accessibility, spacing, typography, hierarchy, interaction design and visual polish.
6. Do not introduce unnecessary complexity.
7. Do not create AI-generated-looking UI.
8. Do not blindly copy the supplied reference image.

---

# MANDATORY SKILLS

At the very beginning of this task, explicitly use and follow all relevant installed skills:

- `/frontend`
- `/design-taste-frontend`
- `/ui-ux-pro-max`
- `/minimalist-ui`
- `/taste`

Read the relevant skill instructions completely before beginning the implementation.

Treat these skills as design and implementation guidance, not as optional suggestions.

If the skills provide conflicting recommendations, prioritize:

**existing application functionality → accessibility/usability → visual consistency → design trends.**

---

# IMPORTANT CONTEXT

The application is **Bake n Take**, a bakery web store.

The customer-facing application is already functional.

This task is **NOT a rebuild**.

This is a comprehensive **UI/UX redesign and visual refinement of the existing customer web store**.

Do NOT rebuild the backend.

Do NOT redesign the owner/admin dashboard in this phase.

Do NOT remove or weaken existing functionality.

Do NOT replace working business logic simply because the UI is being redesigned.

The objective is:

> Make the existing customer web store feel like a professionally designed premium bakery product while retaining the existing functionality and data architecture.

---

# REFERENCE IMAGE

A bakery website screenshot has been provided as a **visual reference only**.

Study it for:

- visual hierarchy
- section rhythm
- whitespace
- product presentation
- category presentation
- use of imagery
- CTA placement
- section transitions
- overall warmth
- visual storytelling
- information density

DO NOT copy:

- its exact layout
- its colors
- its typography
- its component structure
- its wording
- its illustrations
- its branding
- its spacing
- its exact cards
- its visual identity

The final design must belong to **Bake n Take**.

The existing Bake n Take login/signup design is the primary visual foundation.

---

# PHASE 0 — DEEP PROJECT ANALYSIS

Before modifying ANY UI:

### 1. Inspect the entire repository

Read and understand the relevant project structure.

Identify:

- customer routes
- customer layouts
- shared components
- navigation components
- footer
- authentication UI
- product components
- category components
- product detail pages
- cart
- checkout/order pages
- order tracking
- notifications
- profile/account pages
- offer components
- customization UI
- loading states
- error states
- empty states
- dialogs/modals
- mobile navigation
- theme system
- Supabase integrations
- server actions
- API routes
- database-dependent UI
- shared design tokens
- Tailwind configuration
- global CSS
- fonts
- icons
- image handling

Find **every route belonging to the customer-facing store**.

Do not assume the routes from this prompt are complete.

Create an internal inventory of every customer page and reusable component before redesigning anything.

---

# PHASE 1 — UNDERSTAND THE EXISTING FUNCTIONALITY

Before touching components, understand what each customer page currently does.

For every route determine:

- purpose
- user flow
- data dependencies
- interactive elements
- forms
- validation
- navigation behavior
- authentication requirements
- Supabase dependencies
- product/customization dependencies
- cart behavior
- offer/discount behavior
- notification behavior
- order behavior
- loading behavior
- error behavior
- empty-state behavior

Do not modify functionality unless absolutely necessary for the redesigned UI.

If functionality appears unusual but is working, preserve it unless it directly conflicts with usability.

---

# PHASE 2 — ESTABLISH THE BAKE N TAKE DESIGN SYSTEM

The login/signup pages already established the visual direction.

Use that aesthetic as the foundation.

The website should feel:

- cozy
- premium
- calm
- warm
- elegant
- modern
- trustworthy
- handcrafted
- minimal
- sophisticated
- bakery-oriented

Avoid making it:

- childish
- overly pink
- overly colorful
- cartoonish
- generic SaaS
- template-like
- visually noisy
- excessively rounded
- full of gradients
- full of unnecessary glassmorphism
- AI-slop looking

## DESIGN PRINCIPLES

Use:

- strong typography hierarchy
- generous but intentional whitespace
- refined warm colors
- subtle contrast
- restrained borders
- subtle shadows
- elegant cards
- carefully controlled corner radius
- meaningful visual hierarchy
- consistent spacing
- subtle motion
- excellent alignment
- high-quality imagery
- restrained decorative elements

The design should look intentionally art-directed rather than assembled from generic UI components.

---

# TYPOGRAPHY

Create a clear typography hierarchy.

Use an elegant display typeface where appropriate for bakery/editorial moments and a highly readable modern sans-serif for UI.

Do not overuse decorative typography.

Typography must work across:

- desktop
- tablet
- mobile
- product cards
- navigation
- buttons
- forms
- headings
- prices
- promotional banners

Fix all typography issues such as:

- incorrect font sizes
- weak hierarchy
- inconsistent weights
- poor line heights
- awkward wrapping
- excessive letter spacing
- unreadable text
- inconsistent casing

---

# COLOR SYSTEM

Derive the final palette from the existing Bake n Take login/signup design.

Do not simply copy the screenshot's colors.

Create a coherent token-based palette covering:

- page background
- elevated surface
- card surface
- primary text
- secondary text
- muted text
- borders
- primary CTA
- secondary CTA
- hover states
- success
- warning
- error
- promotional accent

Maintain excellent contrast and accessibility.

Avoid introducing random colors on individual pages.

---

# COMPONENT CONSISTENCY

Create or refine reusable components where appropriate.

Examples:

- StoreNavbar
- MobileNavigation
- HeroCarousel
- CategoryNavigation
- ProductCard
- ProductGrid
- ProductQuickView
- OfferBanner
- OfferCarousel
- CustomizationSection
- ReviewSection
- NotificationPopover
- CartButton
- EmptyState
- LoadingState
- ErrorState
- Footer
- SectionHeader
- CTA
- Badge
- PriceDisplay

Do not duplicate the same UI pattern across multiple pages.

If the same pattern appears multiple times, create a reusable component where appropriate.

Do not over-engineer.

---

# PHASE 3 — GLOBAL CUSTOMER NAVIGATION

Redesign the customer navbar.

It should contain:

- Bake n Take logo
- store name
- store tagline where appropriate
- Home
- Bake List / Shop
- relevant navigation links
- cart
- notifications
- profile
- theme toggle
- logout where appropriate

The exact links should be based on the routes discovered in the existing project.

## Desktop

Create a clean, premium navigation experience.

Avoid excessive height.

Maintain excellent horizontal spacing.

The navbar should feel integrated into the page rather than looking like a generic dashboard header.

## Mobile

Use a polished hamburger/menu interaction.

The mobile menu should:

- be closable
- have clear hierarchy
- have smooth animation
- remain accessible
- not obscure important content unnecessarily
- preserve all navigation functionality

---

# PHASE 4 — HOME PAGE REDESIGN

Redesign the complete customer homepage.

The homepage should follow this conceptual structure.

## 1. NAVBAR

Premium responsive navigation.

---

## 2. HERO / PRIMARY CAROUSEL

The existing hero carousel supports dynamic content.

Preserve that functionality.

It must support:

- offers
- product news
- promotional content
- default promotional slides
- configurable CTA
- owner-controlled visibility
- dynamic content

The hero should feel visually connected to the navbar.

It should NOT look like an isolated rectangular banner dropped into the page.

Use:

- strong composition
- premium imagery
- restrained decorative elements
- excellent typography
- clear CTA hierarchy
- responsive image treatment
- subtle transitions

Make the carousel feel like a major part of the brand identity.

---

# 3. CATEGORIES

The store currently does not have category images.

Therefore:

**DO NOT invent fake category images.**

Instead create a visually interesting category navigation system using:

- typography
- icons where appropriate
- subtle illustrations/shapes if genuinely useful
- category-specific visual treatment
- refined cards
- active-state design
- elegant hover interactions

Include:

**All Products**

followed by the dynamically loaded categories.

When a category is selected, preserve the existing filtering behavior.

The category UI must not simply be a row of generic pills.

---

# 4. BEST SELLERS / TRENDING

Create a premium product section.

Use the actual product data.

Do not hardcode products.

The section should communicate:

- product image
- product name
- price
- relevant rating/review information if available
- customization availability where applicable
- offer/discount information where applicable
- quick add/cart functionality where currently supported

Improve product card hierarchy dramatically.

Avoid excessively dense cards.

---

# 5. CUSTOMIZATION SECTION

Create a dedicated section highlighting products that support custom designs.

Only show products that actually have customization enabled.

Clearly communicate:

- customizable
- upload your design
- available options
- starting price where appropriate

Use a visually distinctive layout while remaining consistent with the main design system.

The section should encourage customers to explore customization without feeling like an advertisement popup.

---

# 6. OFFER CAROUSEL

Create a dedicated offer carousel separate from the primary hero carousel.

This carousel should display actual active offers.

Preserve all existing offer/business logic.

Support:

- percentage discounts
- BOGO
- quantity-based offers
- mix-and-match offers
- applicable categories
- applicable products
- coupon-related promotions
- dynamically configured promotional content

Clicking an offer should navigate to the appropriate destination according to its configuration.

Examples:

- product-specific offer → product
- category offer → category
- bundle offer → relevant product/category selection
- store-wide offer → shop/offers destination

Do not hardcode destinations.

---

# 7. REVIEWS

Redesign the customer reviews section.

If real review data exists, use it.

Do not invent fake reviews.

If there are no reviews:

Create a tasteful empty state that does not make the website look broken.

Keep the section visually calm and trustworthy.

---

# 8. FOOTER

The footer should be one of the strongest branded areas of the site.

All store information must come from the existing store settings/database.

Do not hardcode:

- store name
- logo
- address
- phone
- email
- social links
- business information

Include relevant:

- logo
- store name
- tagline
- contact information
- address
- social links
- navigation
- shop categories
- account links
- order/help links
- legal links where available
- copyright

Ensure the footer works beautifully on mobile.

---

# PHASE 5 — REDESIGN EVERY CUSTOMER PAGE

After completing the homepage, identify every customer-side route discovered during repository analysis.

Redesign them one by one.

At minimum, inspect whether the application contains:

- Shop / Bake List
- Product listing
- Product detail
- Product customization
- Cart
- Order review
- Checkout
- Order tracking
- Order history
- Notifications
- Profile/account
- Authentication-related pages
- Password recovery
- Any offer/coupon-related customer page
- Any other customer-facing route

Do not stop after redesigning the homepage.

Every customer page must feel like it belongs to the same product.

---

# PRODUCT LISTING PAGE

Create an elegant shopping experience.

Consider:

- category filtering
- sorting
- search if already supported
- product grid
- responsive layout
- empty state
- loading state
- product availability
- promotional pricing
- customization badges

Do not overload the UI with filters that do not exist in the current application.

---

# PRODUCT DETAIL PAGE

Improve:

- image presentation
- product information hierarchy
- price
- discount presentation
- category
- description
- flavour selection
- flavour additional charges
- size/batch selection
- quantity
- custom design upload
- customization instructions
- cart action
- order action
- validation
- mobile usability

The customization flow must be extremely clear.

Customers should immediately understand:

**What am I buying?**

**What can I customize?**

**How much does each customization cost?**

**What will my final price be?**

---

# CART

Redesign the cart while preserving all current behavior.

Clearly communicate:

- products
- selected customizations
- quantities
- prices
- discounts
- offer application
- subtotal
- final amount
- checkout/order action

Avoid visual clutter.

---

# ORDER / CHECKOUT

Redesign the order review flow.

Preserve:

- customer details
- editable customer information
- selected products
- customization details
- quantity
- pricing
- applicable discounts
- promo code functionality
- payment selection
- COD
- order confirmation

Make the process feel simple and trustworthy.

---

# ORDER TRACKING

Create a polished tracking experience.

Clearly visualize order states such as:

- Placed
- Baking
- Ready for pickup
- Done

Use appropriate visual hierarchy and status indicators.

Preserve real-time/status functionality if already implemented.

---

# NOTIFICATIONS

Do NOT create a separate notifications page if the existing architecture uses the notification popover.

The notification icon should remain the primary interaction.

Ensure:

- unread state
- read state
- delete action
- delete-read functionality if already implemented
- click-to-navigate behavior
- customer order notifications open the appropriate order tracking page
- outside click closes the notification layer
- keyboard accessibility
- mobile usability

Preserve all existing notification logic.

---

# PROFILE / ACCOUNT

Redesign the profile/account interface.

Maintain access to all currently supported functionality.

Use clear sections rather than a dashboard-like cluttered layout.

---

# AUTHENTICATION PAGES

The login/signup pages already established the visual direction.

Do NOT redesign them into a completely different visual language.

Instead ensure:

- customer login
- customer signup
- owner login
- password recovery
- OAuth flows
- error states
- loading states

feel visually related to the redesigned store.

The customer store should feel like the same product from authentication → shopping → checkout → tracking.

---

# RESPONSIVE DESIGN

This is mandatory.

Do not design desktop first and merely shrink it.

Explicitly optimize:

### Large desktop

- 1440px+
- wide screens

### Desktop

- 1024–1439px

### Tablet

- 768–1023px

### Mobile

- 320–767px

Check:

- navbar
- carousel
- product grids
- category navigation
- forms
- buttons
- modals
- notification popover
- cart
- checkout
- footer
- typography
- spacing
- image cropping

No horizontal overflow.

No clipped content.

No broken grids.

No microscopic text.

No excessively tall mobile sections.

---

# ANIMATION & INTERACTION

Use tasteful motion.

Animations should communicate hierarchy and interaction.

Use subtle:

- page transitions where appropriate
- hover states
- card interactions
- carousel transitions
- button feedback
- menu transitions
- notification transitions
- modal transitions
- image transitions
- scroll reveal where appropriate

Avoid:

- excessive bouncing
- gimmicky animations
- slow animations
- constant movement
- animation everywhere
- animations that interfere with usability

Respect reduced-motion preferences.

---

# ACCESSIBILITY

Audit the redesigned UI for:

- semantic HTML
- keyboard navigation
- visible focus states
- accessible labels
- button semantics
- image alt text
- color contrast
- form accessibility
- modal accessibility
- carousel accessibility
- mobile menu accessibility

Do not sacrifice accessibility for aesthetics.

---

# DATA & FUNCTIONALITY SAFETY

This is an existing production-style application.

Therefore:

**DO NOT replace real data with mock data.**

**DO NOT introduce hardcoded products.**

**DO NOT introduce fake offers.**

**DO NOT modify Supabase schemas unless absolutely required.**

**DO NOT modify authentication logic.**

**DO NOT modify order business logic merely for visual reasons.**

**DO NOT break existing routes.**

**DO NOT break existing links.**

**DO NOT remove functionality because the new UI does not currently need it.**

The UI must adapt to the existing data model.

---

# LOADING / EMPTY / ERROR STATES

Every redesigned page must account for:

### Loading

Use elegant skeletons instead of abrupt blank spaces.

### Empty

Create intentional empty states.

Examples:

- no products
- no category products
- empty cart
- no notifications
- no reviews
- no active offers
- no orders

### Error

Show friendly, useful error states without exposing technical information to customers.

---

# PERFORMANCE

Do not sacrifice performance for visual polish.

Pay attention to:

- image optimization
- lazy loading
- unnecessary client components
- unnecessary JavaScript
- excessive animation
- duplicate API calls
- unnecessary rerenders
- large bundles
- carousel performance

Use the existing Next.js architecture correctly.

Prefer server rendering where appropriate.

Do not convert server components into client components without a reason.

---

# SEO

Preserve and improve appropriate:

- metadata
- page titles
- descriptions
- semantic hierarchy
- image alt text
- structured content

Do not damage existing SEO behavior.

---

# IMPLEMENTATION STRATEGY

Do NOT modify everything at once.

Work systematically.

Recommended sequence:

1. Analyze repository.
2. Analyze current customer routes.
3. Analyze existing login/signup design.
4. Analyze installed design skills.
5. Establish global design tokens.
6. Refine typography.
7. Refine global background/surfaces.
8. Redesign navbar.
9. Redesign footer.
10. Redesign reusable components.
11. Redesign homepage.
12. Redesign shop/product listing.
13. Redesign product detail/customization.
14. Redesign cart.
15. Redesign order/checkout.
16. Redesign order tracking.
17. Redesign notifications.
18. Redesign profile/account.
19. Redesign remaining customer pages.
20. Perform responsive audit.
21. Perform accessibility audit.
22. Perform functionality regression checks.
23. Fix visual inconsistencies.
24. Run production build.

---

# VISUAL QUALITY BAR

Before considering the task complete, ask:

> Would this website look professionally designed if a real customer saw it for the first time?

Specifically inspect:

- spacing consistency
- alignment
- typography
- card proportions
- button sizes
- visual hierarchy
- section rhythm
- image quality
- contrast
- navbar proportions
- footer proportions
- mobile experience
- empty states
- loading states
- error states
- animation quality
- consistency between pages

Remove anything that looks like:

- generic shadcn defaults
- AI-generated UI
- template leftovers
- unnecessary gradients
- random rounded containers
- inconsistent cards
- arbitrary colors
- excessive borders
- excessive shadows
- poor spacing
- inconsistent typography

---

# REFERENCE IMAGE ANALYSIS

Use the attached bakery screenshot as inspiration for **composition and visual storytelling only**.

Do not reproduce it.

Instead ask:

- What makes the screenshot visually appealing?
- How does it establish hierarchy?
- How does it guide the customer's eye?
- How does it separate sections?
- How does it present products?
- How does it balance text and imagery?
- How does it create a premium bakery feeling?

Then reinterpret those principles using the Bake n Take visual identity.

---

# FINAL VERIFICATION

Before finishing:

1. Verify every customer route still works.
2. Verify navigation still works.
3. Verify authentication links still work.
4. Verify product data still loads.
5. Verify category filtering still works.
6. Verify customization still works.
7. Verify cart functionality still works.
8. Verify order flow still works.
9. Verify offers/discount display still works.
10. Verify notifications still work.
11. Verify order tracking navigation still works.
12. Verify store settings are still reflected dynamically.
13. Verify mobile layout.
14. Verify tablet layout.
15. Verify desktop layout.
16. Verify dark/light theme if currently supported.
17. Verify there is no horizontal overflow.
18. Verify there are no console errors introduced by the redesign.
19. Run the normal project tests/typecheck/lint/build as appropriate.

Do NOT spend excessive time on full E2E testing unless explicitly requested.

Focus primarily on implementation quality and normal regression validation.

---

# CRITICAL RULE

If you encounter an existing implementation that you do not understand:

**STOP AND INSPECT IT FIRST.**

Do not guess.

Do not replace it with a new implementation.

Do not create mock functionality.

Do not assume the database schema.

Do not assume the route structure.

Do not assume the product model.

Read the relevant code and understand the existing architecture before modifying it.

---

# DEFINITION OF DONE

The task is complete only when:

- Every customer-facing page has been visually redesigned.
- All pages share one coherent Bake n Take design language.
- The design is premium, calm, warm and modern.
- The login/signup aesthetic naturally connects with the store.
- The homepage has the complete intended section structure.
- The hero carousel remains dynamic.
- The offer carousel remains dynamic.
- Categories remain dynamic.
- Products remain dynamic.
- Customizable products remain dynamic.
- Store settings remain dynamic.
- Cart functionality is untouched and working.
- Ordering functionality is untouched and working.
- Notifications remain functional.
- Order tracking remains functional.
- Existing Supabase functionality remains intact.
- No dummy data has been introduced.
- No existing functionality has been unnecessarily removed.
- Desktop, tablet and mobile layouts are polished.
- Accessibility has been considered.
- Loading, empty and error states are polished.
- The production build succeeds.
- The resulting website looks like one intentionally designed professional product rather than a collection of separately generated pages.

Do not stop after making the homepage look good.

**The entire customer web store must feel like one cohesive, professionally designed bakery experience.**
