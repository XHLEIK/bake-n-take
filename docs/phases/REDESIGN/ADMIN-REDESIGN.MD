# BAKE N TAKE — PRODUCTION ADMIN FRONTEND REDESIGN

## Admin Application Shell + Sidebar + Minimal Dashboard

You are working on the production frontend of the "Bake n Take" bakery commerce platform.

Your task is to completely redesign and establish the ADMIN APPLICATION SHELL while preserving all existing functionality and the established Bake n Take visual identity.

This is a serious production-quality frontend task.

I am giving you FULL DESIGN AUTHORITY.

Do not limit yourself to rearranging the existing UI.

You are expected to:

- inspect the existing implementation deeply
- identify design and UX flaws yourself
- research appropriate patterns
- use the available design skills and MCP tools
- make independent professional design decisions
- preserve existing functionality
- produce a polished, cohesive, production-ready result

The screenshots provided in this task show the CURRENT admin implementation.

They are NOT the target design.

Use them only to understand the current state and identify what needs to improve.

============================================================ 0. PRIMARY OBJECTIVE
============================================================

Transform the current owner/admin area from a prototype-style page into a proper modern administration application.

The final experience should feel like:

"An intentionally designed premium bakery management application."

It must NOT feel like:

- an AI-generated dashboard
- a generic SaaS template
- a Bootstrap admin panel
- a random collection of cards
- a developer prototype
- an unfinished "coming soon" page

The customer storefront and admin application must clearly belong to the SAME Bake n Take brand.

However:

DO NOT make the admin look like a copy of the storefront.

The storefront is customer-focused and emotional.

The admin is operational, structured and information-focused.

They should share the same:

- visual language
- color system
- typography
- spacing philosophy
- radii
- borders
- iconography
- interaction language
- overall brand personality

============================================================

1. MANDATORY DESIGN SKILLS AND TOOLS
   \============================================================

Before implementation, use every relevant design capability available in this environment.

MANDATORY:

- /graphify
- /ui-ux-pro-max
- /frontend-taste
- /taste
- UI Skills MCP

Also use any other installed skill that is clearly relevant to:

- frontend architecture
- UI design
- responsive design
- accessibility
- visual design
- interaction design
- design systems

If a skill has a slightly different installed name, inspect the available skills and use the closest appropriate one.

Do NOT pretend to use a skill if it is unavailable.

Do NOT skip design research simply because you already understand the requested layout.

The objective is to combine:

- repository understanding
- existing project design language
- established UX principles
- modern admin navigation patterns
- professional frontend implementation

============================================================ 2. MANDATORY FIRST STEP — DEEP REPOSITORY INDEXING
============================================================

BEFORE modifying ANY file:

Use /graphify FIRST if it is available.

Deeply index the complete repository.

Do not immediately start coding.

Build a reliable mental model of the application.

Inspect:

### Application architecture

- Next.js version
- App Router structure
- route groups
- layouts
- loading states
- error states
- middleware
- server components
- client components
- shared components
- UI primitives

### Authentication

- Supabase Auth
- authentication flow
- owner/admin authentication
- customer authentication
- session handling
- authorization
- role checks
- protected routes

### Existing admin area

Find the exact routes and components for:

- owner/admin home
- orders
- products
- offers
- hero carousel
- store settings
- notifications
- account/profile
- logout

### Existing storefront

Deeply inspect the customer-facing application because it is the primary visual reference for the admin brand.

Inspect:

- homepage
- header
- footer
- login/signup
- product page
- Bake List
- buttons
- cards
- typography
- colors
- backgrounds
- borders
- radii
- icons
- responsive behavior
- theme system
- dark/light mode if present
- reusable UI components
- design tokens

### Data and business logic

Understand how the admin pages obtain their data.

Inspect:

- Supabase
- database queries
- server actions
- API routes
- Prisma if present
- RLS
- stores/settings
- products
- categories
- offers
- orders
- carousel
- notifications

DO NOT change business logic simply to achieve the visual redesign.

============================================================ 3. DO NOT ASSUME
============================================================

Do NOT:

- assume a route does not exist because you haven't found it yet
- recreate an existing component
- create duplicate navigation
- create duplicate layouts
- create duplicate data-fetching logic
- invent database fields
- invent APIs
- invent business rules
- invent authentication behavior
- replace existing architecture unnecessarily
- rewrite working functionality merely because another implementation is possible

If something already exists, understand and reuse it.

If something is incomplete, integrate with the existing architecture.

If something is genuinely missing, implement only what is necessary.

============================================================ 4. DESIGN RESEARCH
============================================================

After indexing the repository, perform a focused design investigation.

Use:

/ui-ux-pro-max
/frontend-taste
/taste
UI Skills MCP

Research and reason about:

- modern admin application shells
- persistent sidebar navigation
- responsive sidebar/drawer patterns
- dashboard navigation hierarchy
- active navigation states
- mobile navigation
- accessible navigation
- compact application headers
- premium neutral/dark interfaces
- bakery/food brand interfaces
- information density
- dashboard UX patterns

Do NOT copy another product's design.

Use external patterns only as design inspiration and UX reference.

Bake n Take must retain its own identity.

============================================================ 5. VISUAL AUDIT — FULL AUTHORITY
============================================================

Before implementing, critically audit the CURRENT admin UI shown in the screenshots and the actual code.

Identify every meaningful frontend problem you can find.

Audit:

### Layout

- poor composition
- excessive empty space
- awkward content width
- weak alignment
- inconsistent containers
- poor vertical rhythm
- poor horizontal rhythm
- unnecessary sections

### Typography

- wrong hierarchy
- inconsistent font sizes
- weak contrast
- excessive text
- poor line lengths
- incorrect emphasis
- inconsistent weight

### Components

- oversized cards
- unnecessary cards
- inconsistent radii
- excessive borders
- weak buttons
- inconsistent icon sizing
- unnecessary decoration

### Navigation

- unclear hierarchy
- duplicated navigation
- weak active states
- excessive navigation choices
- poor discoverability
- poor mobile behavior

### Branding

- weak store identity
- inconsistent logo usage
- static/hardcoded branding
- mismatch with storefront
- poor brand hierarchy

### Responsive behavior

- horizontal overflow
- broken mobile layout
- poor tablet layout
- oversized desktop elements
- mobile menu issues
- overlay issues
- incorrect spacing at breakpoints

### Accessibility

- missing focus states
- poor contrast
- inaccessible controls
- poor semantics
- incorrect interactive elements
- keyboard navigation issues

### Interaction

- unclear clickable elements
- poor hover states
- poor active states
- confusing navigation
- unnecessary animation
- missing feedback

Fix the problems you discover.

Do NOT wait for me to point them out individually.

============================================================ 6. CURRENT ADMIN NAVIGATION
============================================================

The existing admin area currently has five main management destinations:

1. Orders
   Fulfilment, statuses and timeline

2. Products
   Catalog, categories, prices and images

3. Offers
   Discounts, coupons and banners

4. Hero Carousel
   Homepage highlights and campaigns

5. Store Settings
   Name, logo, hours and other configuration

These should become the primary administration navigation.

Additionally, create:

6. Dashboard

Final navigation order:

Dashboard
Orders
Products
Offers
Hero Carousel
Store Settings

============================================================ 7. CREATE A REAL ADMIN APPLICATION SHELL
============================================================

Create a reusable admin shell/layout.

The conceptual structure should be:

---

| ADMIN APPLICATION  |
| ------------------ |
| Sidebar            | Main content |
|                    |              |
| Bake n Take        | Page header  |
| Store identity     |              |
|                    | Page content |
| Dashboard          |              |
| Orders             |              |
| Products           |              |
| Offers             |              |
| Hero Carousel      |              |
| Store Settings     |              |
|                    |              |
|                    |              |
| Account / Sign out |              |

---

This is only the conceptual structure.

Use your own professional judgment for the final visual implementation.

============================================================ 8. SIDEBAR — PRIMARY REQUIREMENT
============================================================

Create a polished reusable Admin Sidebar.

The sidebar is now the PRIMARY navigation.

The old five-card navigation grid must NOT remain.

Do not simply turn the existing cards into vertical cards.

Design a proper application navigation system.

The sidebar should contain:

### Brand

- dynamic store logo
- dynamic store name
- dynamic owner/store identity where appropriate

### Main navigation

- Dashboard
- Orders
- Products
- Offers
- Hero Carousel
- Store Settings

### Account area

Appropriate account controls such as:

- account/profile
- sign out

Only include controls that genuinely belong there.

Do not duplicate controls unnecessarily.

============================================================ 9. DYNAMIC BRANDING
============================================================

The store identity must come from the existing dynamic store settings.

DO NOT hardcode:

"Bake n Take"

"Sudipta"

the logo

store description

contact information

or any other configurable store information.

Reuse the existing dynamic branding architecture.

The sidebar should automatically reflect the configured store identity.

If the owner changes the store logo/name/settings, the admin branding should update accordingly.

Do not introduce a second branding data source.

============================================================ 10. SIDEBAR VISUAL DESIGN
============================================================

The sidebar must match Bake n Take's established visual identity.

Use the existing storefront design system.

The visual direction should be:

- premium
- warm
- elegant
- calm
- bakery-inspired
- sophisticated
- restrained
- professional

Use the established:

- espresso/chocolate tones
- warm cream
- muted bakery accents
- subtle amber/gold accents
- existing typography
- existing border language
- existing radii
- existing theme behavior

Do not introduce a completely new color palette.

Avoid:

- generic blue SaaS colors
- neon accents
- excessive gradients
- excessive glassmorphism
- giant shadows
- glowing cards
- excessive decorative elements
- random illustrations
- excessive rounded containers
- visual clutter

Use hierarchy through:

- spacing
- typography
- tonal contrast
- subtle borders
- restrained elevation
- active state
- grouping

============================================================ 11. NAVIGATION STATES
============================================================

Every navigation item must have:

- default state
- hover state
- active state
- keyboard focus state
- disabled state if relevant

The active route must be immediately obvious.

Use appropriate:

- background treatment
- icon treatment
- typography weight
- subtle accent

Do NOT use aggressive bright blocks that overpower the interface.

Use aria-current where appropriate.

Navigation should be understandable without relying only on color.

============================================================ 12. SIDEBAR DESKTOP BEHAVIOR
============================================================

On desktop:

Use a persistent sidebar.

Choose an appropriate width based on actual content.

Do not make it unnecessarily wide.

Do not make it so narrow that labels become uncomfortable.

The sidebar should feel stable and calm.

The main content should have sufficient breathing room.

Avoid making the main content unnecessarily centered in a huge empty viewport.

Use professional application-shell spacing.

============================================================ 13. MOBILE / TABLET NAVIGATION
============================================================

Do NOT simply shrink the desktop sidebar.

Design an intentional responsive navigation system.

For smaller screens, use an appropriate:

- drawer
- slide-over navigation
- compact navigation pattern

Choose the best approach after inspecting the existing application.

Requirements:

- works at 320px
- works at 375px
- works at 390px
- works at 430px
- works at 768px
- works at 1024px
- works at 1280px
- works at 1440px
- works at 1920px

The mobile navigation must:

- open reliably
- close reliably
- navigate correctly
- not cause horizontal scrolling
- not blur the entire page
- not leave broken overlays
- not trap the user unexpectedly
- support keyboard interaction where applicable
- have appropriate focus handling
- respect safe areas
- close appropriately after navigation

============================================================ 14. ADMIN HEADER
============================================================

Create or redesign an appropriate admin header/top bar.

Do not automatically preserve the current header.

Audit the current controls:

- logo
- store name
- owner name
- theme toggle
- notifications
- My Account
- logout

Decide where each belongs.

Some may belong in the sidebar.
Some may belong in the header.
Some may belong inside an account menu.

Use professional application-shell conventions.

Avoid duplicated actions.

The header should establish:

- page context
- useful global controls
- account access where appropriate

It must not compete visually with the sidebar.

============================================================ 15. DASHBOARD PAGE
============================================================

Create a dedicated Dashboard route/page.

IMPORTANT:

The actual dashboard functionality will be implemented later.

Therefore, DO NOT implement:

- analytics
- charts
- revenue statistics
- sales graphs
- order metrics
- fake KPI cards
- fake activity feeds
- fake data
- fake recent orders
- fake revenue
- fake customer statistics
- fake charts

Do not invent data simply to make the dashboard look full.

The dashboard should intentionally be minimal.

It should contain only enough structure to establish:

- page title
- appropriate page context
- clean empty/minimal state
- correct spacing
- correct responsive behavior

The result should feel intentionally minimal, NOT unfinished.

============================================================ 16. ABSOLUTELY REMOVE "COMING NEXT"
============================================================

The current page contains:

"Coming next"

with items such as:

- Publish offers and promotions
- See incoming orders
- Customer order notifications

REMOVE THIS ENTIRE CONCEPT.

Do NOT:

- redesign it
- move it into the sidebar
- replace it with "Coming Soon"
- create roadmap cards
- create future-feature cards
- retain its text
- create fake dashboard content

The new admin application must feel like a real product.

Not a development roadmap.

============================================================ 17. REDESIGN THE CURRENT OWNER HOME
============================================================

The current owner home contains:

- five large navigation cards
- signed-in email text
- Owner heading
- placeholder description
- owner information card
- Coming Next section
- future feature cards
- sign-out button
- excessive empty vertical space

The new architecture should remove the prototype feel.

Remove the old five-card navigation grid.

Remove the entire Coming Next section.

Remove future-feature cards.

Remove unnecessary placeholder copy.

Remove redundant navigation.

Reduce unnecessary vertical whitespace.

The new page should be the admin shell with the minimal Dashboard as its initial destination.

============================================================ 18. DO NOT CREATE A SECOND NAVIGATION SYSTEM
============================================================

This is critical.

The sidebar is the primary navigation.

Do NOT retain:

- large navigation cards
- duplicate navigation grids
- redundant shortcut navigation
- duplicate sidebar-like controls

If shortcuts are later needed, they should be intentionally designed as dashboard functionality.

For THIS phase, the sidebar is sufficient.

============================================================ 19. UX LAWS AND PRINCIPLES
============================================================

Apply these principles in actual design decisions.

### Jakob's Law

Use familiar application navigation patterns.

The owner should immediately understand the interface.

### Fitts's Law

Important navigation and actions should have appropriate hit targets.

### Hick's Law

Keep navigation choices organized and understandable.

### Miller's Law

Group related navigation items logically.

### Gestalt Principles

Use:

- proximity
- similarity
- common region
- continuity
- figure-ground

### Recognition over Recall

Users should recognize where they are instead of remembering navigation states.

### Consistency and Standards

Use consistent:

- spacing
- icons
- interaction
- labels
- component behavior

### Visibility of System Status

Users should clearly understand:

- active page
- navigation state
- menu state

### User Control and Freedom

Users should always be able to:

- navigate back
- close mobile navigation
- access account controls
- sign out

### Error Prevention

Avoid ambiguous interactive areas.

### Aesthetic-Usability Effect

Make the interface visually coherent and polished without sacrificing usability.

### Progressive Disclosure

Do not expose unnecessary complexity.

### Tesler's Law

Keep complexity inside the interface where it can be handled consistently.

Do not mechanically mention these laws in the UI.

Use them to make better design decisions.

============================================================ 20. INFORMATION HIERARCHY
============================================================

The interface must clearly communicate:

1. Brand / application identity
2. Current location
3. Primary navigation
4. Current page content
5. Secondary actions
6. Account controls

Nothing should compete unnecessarily with the current page.

The owner should be able to answer immediately:

"Where am I?"

"What can I manage?"

"How do I switch sections?"

"How do I return to Dashboard?"

"How do I access my account?"

"How do I sign out?"

============================================================ 21. DESIGN SYSTEM CONSISTENCY
============================================================

Before creating new components, inspect the existing design system.

Reuse existing:

- buttons
- inputs
- dropdowns
- dialogs
- icons
- typography
- spacing tokens
- colors
- radii
- shadows
- theme variables

Do not create competing versions of components that already exist.

If the existing design system has a flaw, fix it carefully only when necessary.

Avoid introducing arbitrary one-off values everywhere.

Create a coherent visual rhythm.

============================================================ 22. RESPONSIVE DESIGN
============================================================

Do not treat responsive design as an afterthought.

The layout must intentionally adapt.

Check:

320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px

Inspect:

- sidebar
- mobile drawer
- header
- page title
- content width
- padding
- typography
- navigation labels
- buttons
- overflow
- viewport height
- sticky elements if any

There must be NO:

- horizontal scrollbar
- clipped text
- inaccessible controls
- overlapping navigation
- broken overlays
- accidental page blur
- excessive empty space
- tiny unusable buttons

============================================================ 23. ACCESSIBILITY
============================================================

The navigation must be production-quality and accessible.

Implement:

- semantic nav elements
- semantic buttons/links
- keyboard navigation
- visible focus indicators
- aria-current where appropriate
- aria-expanded for expandable navigation
- appropriate accessible names
- sensible tab order
- sufficient contrast
- accessible mobile drawer
- reduced-motion support where appropriate

Do not sacrifice accessibility for visual design.

============================================================ 24. ANIMATION AND MOTION
============================================================

Use motion only when it improves the experience.

Good examples:

- subtle hover transitions
- active navigation transitions
- mobile drawer transition
- subtle menu transitions

Avoid:

- excessive motion
- bouncing elements
- unnecessary page animations
- slow transitions
- decorative animation
- attention-seeking effects

The interface should feel polished and responsive.

============================================================ 25. PERFORMANCE
============================================================

Keep the admin shell lightweight.

Do not unnecessarily convert server components to client components.

Avoid:

- unnecessary client-side state
- unnecessary dependencies
- large animation libraries
- duplicate data fetching
- excessive JavaScript
- unnecessary API requests

Follow the project's existing Next.js architecture.

Use server components where appropriate.

============================================================ 26. ROUTING
============================================================

First inspect the existing admin routes.

Reuse existing routes.

Do NOT create duplicate routes.

The sidebar should correctly link to:

Dashboard
Orders
Products
Offers
Hero Carousel
Store Settings

Only create the Dashboard route if it does not already exist.

Existing pages must continue functioning.

The shell should wrap the appropriate admin routes using the project's existing routing architecture.

============================================================ 27. AUTHORIZATION
============================================================

Do not weaken security.

Preserve:

- Supabase Auth
- owner authentication
- role validation
- protected routes
- authorization checks
- existing middleware
- RLS
- server-side protection

The sidebar is only navigation.

It must never be treated as an authorization mechanism.

A customer must not gain access to owner functionality simply because an admin route exists.

============================================================ 28. NO BACKEND REWRITE
============================================================

This phase is primarily frontend architecture and design.

Do NOT:

- change database schema
- rewrite Supabase configuration
- rewrite authentication
- change business logic
- rewrite order logic
- rewrite product logic
- rewrite offer logic
- rewrite carousel logic
- rewrite store settings logic

Only modify backend/data code if a minimal change is genuinely required to support the new frontend shell.

If a backend issue is discovered, document it rather than unnecessarily expanding the scope.

============================================================ 29. COMPONENT ARCHITECTURE
============================================================

Create reusable components following the existing project conventions.

Conceptually establish:

- AdminShell
- AdminSidebar
- AdminNavigation
- AdminHeader
- AdminMobileNavigation / Drawer
- DashboardPage

Do not blindly use these exact filenames if the existing project architecture suggests better names.

Follow existing naming conventions.

Avoid excessive abstraction.

Do not create a component for every tiny element.

============================================================ 30. DESIGN THE SIDEBAR FOR FUTURE GROWTH
============================================================

The sidebar should accommodate future dashboard functionality without requiring another redesign.

However:

DO NOT add navigation items that do not currently exist.

Do not create:

- Analytics
- Customers
- Inventory
- Reports
- Payments
- Marketing

unless those are already real routes/features in the project.

The navigation should be extensible without being speculative.

============================================================ 31. STORE THEME / DARK-LIGHT MODE
============================================================

Inspect the existing theme implementation.

If the application already supports light/dark mode:

Integrate the admin shell correctly.

Do not create a separate theme system.

Both modes should maintain:

- sufficient contrast
- brand consistency
- clear hierarchy
- proper borders
- accessible states

Do not simply invert colors.

============================================================ 32. BACKGROUND / VISUAL SEAMS
============================================================

Pay particular attention to the background problems visible in the current frontend.

Avoid:

- awkward gradient seams
- stretched backgrounds
- full-page gradients where they are not needed
- random background changes
- fixed decorative textures that interfere with content
- sections visually bleeding into one another unintentionally

The admin shell should have a deliberate visual structure.

Sidebar and content should feel like one cohesive application.

============================================================ 33. ICONOGRAPHY
============================================================

Use Lucide React if that is the project's established icon system.

Do not introduce random icon libraries.

Icons must:

- have consistent size
- have consistent stroke weight
- align correctly
- support recognition
- never replace necessary labels

Avoid decorative icons with no semantic purpose.

============================================================ 34. CONTENT QUALITY
============================================================

Use concise, purposeful UI copy.

Do not use:

- "Welcome to your amazing dashboard!"
- "Take your business to the next level!"
- generic AI-generated marketing copy
- unnecessary descriptions
- fake metrics
- fake notifications
- placeholder lorem ipsum

Admin interfaces should be clear and operational.

============================================================ 35. VISUAL DENSITY
============================================================

The current admin page has too much unused vertical space.

However, do not solve this by filling the page with meaningless content.

Instead:

- improve shell composition
- establish proper content hierarchy
- use appropriate spacing
- allow the minimal dashboard to breathe
- make navigation efficient
- maintain intentional whitespace

Whitespace is good when intentional.

Empty space caused by poor composition is not.

============================================================ 36. DO NOT OVER-DESIGN
============================================================

Premium does NOT mean adding more decoration.

Avoid:

- excessive gradients
- glass effects
- glowing borders
- oversized typography
- giant icons
- floating cards everywhere
- unnecessary badges
- decorative blobs
- excessive shadows
- excessive animations

The design should feel expensive because it is:

- coherent
- restrained
- intentional
- balanced
- usable

============================================================ 37. IMPLEMENTATION WORKFLOW
============================================================

Follow this exact sequence.

---

PHASE 1 — INDEX
------------------------------------------------------------

Use /graphify.

Index the complete repository.

Do not modify code.

---

PHASE 2 — UNDERSTAND
------------------------------------------------------------

Understand:

- admin routes
- customer routes
- layouts
- components
- design system
- authentication
- store settings
- existing navigation
- existing responsive behavior

---

PHASE 3 — DESIGN RESEARCH
------------------------------------------------------------

Use:

/ui-ux-pro-max
/frontend-taste
/taste
UI Skills MCP

Research and reason about appropriate modern admin shell patterns.

---

PHASE 4 — VISUAL AUDIT
------------------------------------------------------------

Analyze:

- supplied screenshots
- actual implementation
- storefront
- existing design system

Create an internal list of flaws and improvements.

---

PHASE 5 — ARCHITECTURE
------------------------------------------------------------

Determine:

- correct admin layout boundary
- sidebar location
- navigation structure
- header structure
- mobile navigation strategy
- dashboard route
- component reuse

---

PHASE 6 — IMPLEMENTATION
------------------------------------------------------------

Implement:

- Admin Shell
- Sidebar
- Navigation
- Responsive navigation
- Header if appropriate
- Dashboard page

---

PHASE 7 — INTEGRATION
------------------------------------------------------------

Integrate existing admin pages into the shell.

Verify:

Orders
Products
Offers
Hero Carousel
Store Settings

all continue functioning.

---

PHASE 8 — RESPONSIVE QA
------------------------------------------------------------

Test all relevant breakpoints.

---

PHASE 9 — ACCESSIBILITY QA
------------------------------------------------------------

Test keyboard navigation, focus, contrast, semantics and mobile navigation accessibility.

---

PHASE 10 — REGRESSION
------------------------------------------------------------

Run the project's appropriate:

- typecheck
- lint
- unit/component tests
- build

Fix every issue introduced by your changes.

---

PHASE 11 — VISUAL SELF-REVIEW
------------------------------------------------------------

Review the final result like a senior frontend engineer + senior product designer.

Do not stop simply because the requested files compile.

============================================================ 38. VISUAL SELF-REVIEW QUESTIONS
============================================================

Before declaring completion, ask yourself:

### Brand

Does this unmistakably feel like Bake n Take?

### Navigation

Can a first-time owner understand the navigation immediately?

### Jakob's Law

Does the admin behave like a familiar modern application?

### Hierarchy

Is the active page obvious?

### Sidebar

Is the sidebar too wide?
Too narrow?
Too busy?
Too empty?

### Header

Are there redundant controls?

### Typography

Is the hierarchy clear?

### Spacing

Is the vertical rhythm consistent?

### Components

Are there unnecessary cards or borders?

### Responsive

Does it work perfectly on mobile?

### Accessibility

Can it be navigated with keyboard?

### Visual quality

Does anything look like a generic AI dashboard?

### Prototype smell

Does anything still feel temporary?

### Future extensibility

Can the real Dashboard be added later without redesigning the shell?

If any answer is unsatisfactory, fix it before completion.

============================================================ 39. STRICT SCOPE
============================================================

IMPLEMENT NOW:

- Admin application shell
- Admin sidebar
- Dashboard navigation item
- Orders navigation item
- Products navigation item
- Offers navigation item
- Hero Carousel navigation item
- Store Settings navigation item
- responsive navigation
- appropriate admin header
- minimal Dashboard page
- integration of existing admin routes
- visual/UX improvements required for the shell

DO NOT IMPLEMENT NOW:

- dashboard analytics
- charts
- revenue widgets
- fake statistics
- fake orders
- fake activity feeds
- customer analytics
- new business modules
- new database schema
- new promotion logic
- new order logic
- "Coming Next"
- "Coming Soon"
- roadmap cards
- future-feature cards

============================================================ 40. NON-NEGOTIABLE RULES
============================================================

1. Do not code before understanding the repository.

2. Use /graphify first when available.

3. Use the requested design skills and UI Skills MCP.

4. Do not hallucinate architecture.

5. Do not duplicate existing functionality.

6. Do not create duplicate navigation.

7. Do not break authentication.

8. Do not weaken authorization.

9. Do not modify the database unnecessarily.

10. Do not change customer storefront behavior unnecessarily.

11. Do not hardcode store branding when dynamic branding already exists.

12. Do not create fake dashboard data.

13. Do not keep the "Coming Next" section.

14. Do not create generic SaaS dashboard aesthetics.

15. Do not over-design.

16. Do not sacrifice accessibility for aesthetics.

17. Do not sacrifice performance for visual effects.

18. Do not stop at "it works."

19. Perform a genuine visual QA pass.

20. Fix frontend flaws you discover even if they were not explicitly listed in this prompt, provided they are within the scope of the admin shell redesign.

============================================================ 41. DEFINITION OF DONE
============================================================

This task is complete only when:

✓ A proper reusable admin application shell exists.

✓ A polished persistent desktop sidebar exists.

✓ Dashboard is the first navigation destination.

✓ Orders, Products, Offers, Hero Carousel and Store Settings are properly represented.

✓ Existing admin routes work inside the new shell.

✓ Mobile navigation is intentionally designed and functional.

✓ No horizontal overflow exists.

✓ No broken overlays or page-wide blur issues exist.

✓ Active navigation is immediately recognizable.

✓ Dynamic store branding is preserved.

✓ Authentication and authorization remain intact.

✓ Customer storefront functionality remains intact.

✓ The old five-card navigation grid is removed.

✓ The entire "Coming Next" section is removed.

✓ No fake dashboard statistics or placeholder widgets exist.

✓ Dashboard is intentionally minimal.

✓ Typography is cohesive.

✓ Spacing is cohesive.

✓ Colors match the Bake n Take brand.

✓ Borders and radii are consistent.

✓ Icons are consistent.

✓ Accessibility is properly handled.

✓ Responsive behavior is tested.

✓ Typecheck passes.

✓ Lint passes.

✓ Relevant tests pass.

✓ Production build passes.

✓ No unnecessary dependencies were introduced.

✓ The final result looks like a deliberate production application rather than a prototype.

============================================================
FINAL OBJECTIVE
============================================================

Do not think:

"I need to add a sidebar."

Think:

"I am establishing the permanent design and navigation foundation of the Bake n Take administration platform."

The sidebar, shell, header, responsive behavior and Dashboard must therefore be designed so that the future admin features can be added naturally without requiring another major redesign.

The final result should be:

PREMIUM
CALM
COHESIVE
INTUITIVE
RESPONSIVE
ACCESSIBLE
FAST
BAKERY-BRANDED
PRODUCTION-READY

And most importantly:

It should feel obvious to use.
