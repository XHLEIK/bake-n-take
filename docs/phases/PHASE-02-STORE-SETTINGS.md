# BAKE N TAKE — PHASE 2

## Centralized Store Settings & Dynamic Business Identity

## ROLE

Continue working as a senior-level:

- Full-stack engineer
- Frontend engineer
- Backend engineer
- Database architect
- UI/UX designer
- Security engineer
- QA engineer
- DevOps engineer
- Technical documentation engineer

Phase 1 authentication has already been completed successfully.

Treat the existing Phase 1 implementation as the foundation and **do not break, rewrite, or unnecessarily refactor the authentication system**.

The objective of Phase 2 is to create a professional, centralized **Store Settings / Business Information Management System** for the owner dashboard.

All public-facing bakery identity and business information must come from Supabase rather than being hardcoded in the frontend.

---

# 1. PHASE 2 OBJECTIVE

Create a fully functional owner-side **Store Settings** page where the owner can manage the bakery's public business identity and operational information.

The information saved by the owner must automatically become the single source of truth for the entire application.

The same data should be used across:

- Customer storefront
- Login page
- Signup page
- Owner-facing branding where appropriate
- Header
- Footer
- Contact sections
- Store information sections
- Pickup/location sections
- Browser metadata where appropriate
- Future order/checkout pages
- Future emails/notifications
- Future invoices/receipts

Do not duplicate these values across components.

---

# 2. MOST IMPORTANT FIRST STEP — REMOVE STATIC DATA

Before implementing the Store Settings page, perform a complete repository-wide audit for hardcoded bakery/store information.

Search the entire project for:

- Store name
- Bakery name
- Logo URLs
- Logo imports
- Address
- Phone number
- Email address
- WhatsApp number
- Instagram URL
- Facebook URL
- Other social links
- Store tagline
- Opening hours
- Pickup information
- Google Maps links
- Any hardcoded business information
- Placeholder bakery branding
- Demo business information

This includes:

- Login page
- Signup page
- Customer pages
- Footer
- Header
- Navbar
- Mobile navigation
- Owner pages
- Error pages
- Loading pages
- Metadata
- SEO configuration
- Open Graph metadata
- Any shared components
- Any constants/config files
- Any JSON/mock data
- Any test fixtures containing production-like store information

Do not simply replace the values.

Identify where each value is currently coming from and remove the architectural dependency on static store information.

After Phase 2, there must be one authoritative source:

**Supabase Store Settings → Application**

---

# 3. DO NOT LEAVE FALLBACK STATIC BRANDING

Do not keep something like:

"Hardcoded Store Name"

as a hidden fallback in components after the database integration.

If the database is unavailable, display an appropriate loading/error/neutral state rather than silently reverting to outdated business information.

Avoid duplicate sources of truth.

---

# 4. STORE SETTINGS DATABASE MODEL

Create a proper Supabase PostgreSQL structure for store settings.

Because this project currently represents one bakery/store, use a clean singleton-style store settings architecture rather than unnecessarily introducing a multi-tenant system.

The settings model should support at minimum:

### Identity

- Store ID
- Store name
- Short name
- Tagline
- Description
- Logo URL/storage path
- Favicon URL/storage path where appropriate

### Contact

- Primary phone number
- Secondary phone number
- Email address
- WhatsApp number

### Address

Support structured address information:

- Address line 1
- Address line 2
- Locality/area
- City
- State
- Postal/PIN code
- Country

Also support:

- Google Maps URL
- Latitude
- Longitude

Do not rely exclusively on one large free-text address field.

The frontend may still display a formatted address.

---

# 5. SOCIAL MEDIA SETTINGS

Allow the owner to configure social media profiles.

At minimum support:

- Instagram
- Facebook
- WhatsApp

Design the data model so additional platforms can be added later without major architectural changes.

Examples of future platforms:

- YouTube
- X
- TikTok

Do not display a social icon if its corresponding URL is not configured.

Validate URLs before saving them.

---

# 6. BUSINESS HOURS

Add business operating hours.

The owner should be able to configure each day independently:

- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- Sunday

Each day should support:

- Open
- Closed
- Opening time
- Closing time

The data model should allow future support for:

- Multiple opening periods in one day
- Holidays
- Special closures

Do not over-engineer this phase, but structure it so future expansion is possible.

---

# 7. PICKUP INFORMATION

Because this bakery uses customer pickup, add configurable pickup information.

Allow the owner to manage:

- Pickup instructions
- Pickup location
- Pickup notes
- Estimated preparation/pickup information
- Contact instructions

Keep this separate from the physical store address because pickup instructions may change without changing the address.

This information will be used later by the order system.

---

# 8. STORE STATUS

Add a basic store availability/status configuration.

The owner should be able to indicate whether the store is currently:

- Open
- Temporarily closed
- Accepting orders
- Not accepting orders

Do not implement the full order system yet.

This setting should simply establish the backend capability for future phases.

If appropriate, support:

- Manual status
- Status message

Example:

"Orders temporarily paused — back tomorrow at 10 AM."

Do not automatically invent opening/closing behavior yet unless it is explicitly implemented and tested.

---

# 9. CURRENCY & REGIONAL SETTINGS

Add basic regional configuration for future commerce functionality.

At minimum:

- Currency
- Currency symbol
- Country
- Timezone

For the current bakery, the default configuration should be suitable for India.

Do not hardcode currency formatting throughout the application.

Create a centralized formatting approach so future pricing/order phases can use the same configuration.

---

# 10. BRANDING SETTINGS

Allow the owner to control basic brand identity.

At minimum:

- Store name
- Short name
- Tagline
- Logo
- Favicon where appropriate

Optionally support:

- Primary brand color
- Secondary brand color
- Accent color

However, do not build a complete theme editor in Phase 2.

The goal is centralized business identity, not a full website builder.

---

# 11. LOGO STORAGE

Use Supabase Storage for the store logo.

Do not store image binary data directly inside PostgreSQL.

Create an appropriate storage bucket and secure its access.

The owner should be able to:

- Upload logo
- Replace logo
- Remove logo where appropriate

Validate uploads for:

- File type
- File size
- Image validity
- Reasonable dimensions

Do not trust file extensions alone.

Use the Supabase Storage path as the authoritative reference.

---

# 12. IMAGE HANDLING

The logo implementation should work correctly across:

- Login
- Signup
- Header
- Footer
- Customer storefront
- Mobile navigation
- Owner settings preview

Use appropriate image optimization for the existing Next.js architecture.

Avoid unnecessarily downloading the same large image repeatedly.

---

# 13. OWNER SETTINGS PAGE

Create a polished owner dashboard page:

**Store Settings**

The page should be organized into logical sections.

Suggested sections:

### Store Identity

- Logo
- Store name
- Short name
- Tagline
- Description

### Contact Information

- Phone
- Secondary phone
- Email
- WhatsApp

### Store Address

- Address
- City
- State
- PIN
- Country
- Google Maps URL
- Coordinates if required

### Business Hours

- Daily opening/closing hours

### Social Media

- Instagram
- Facebook
- WhatsApp
- Additional supported platforms

### Pickup Information

- Pickup instructions
- Pickup notes

### Store Status

- Accepting orders
- Temporarily closed
- Status message

### Regional Settings

- Currency
- Timezone

Do not make the page unnecessarily complicated.

Use a clean card/section structure with excellent information hierarchy.

---

# 14. STORE SETTINGS UX

The settings page should feel like a professional SaaS/business management interface while remaining consistent with the bakery brand.

Use:

- Existing shadcn/ui system
- Nova preset
- Geist typography
- Lucide icons
- Existing design tokens
- Existing spacing system
- Existing UI conventions

Do not introduce a completely different design language.

---

# 15. SAVE EXPERIENCE

The owner should be able to modify settings and explicitly save changes.

Support:

- Loading state
- Saving state
- Success state
- Validation errors
- Database errors
- Upload errors

Prevent duplicate submissions.

Do not show "Saved successfully" unless the database operation actually succeeds.

---

# 16. UNSAVED CHANGES

Detect unsaved changes where practical.

If the owner modifies settings and attempts to navigate away, warn them when appropriate.

Do not create an annoying confirmation dialog for every navigation.

Use sensible UX.

---

# 17. FORM VALIDATION

Validate settings both client-side and server-side.

Validate:

- Required store name
- Email format
- Phone format
- WhatsApp format
- URL format
- PIN/postal code
- Coordinates
- Business hours
- Currency
- Timezone

Set reasonable maximum lengths.

Do not rely exclusively on HTML validation.

---

# 18. SERVER-SIDE AUTHORIZATION

Only authenticated users with the OWNER role may modify store settings.

Customers must never be able to:

- Update store name
- Change logo
- Change contact details
- Change social links
- Change business hours
- Change store status
- Modify regional settings

The authorization must be enforced server-side.

Do not rely solely on hiding the settings page.

---

# 19. ROW LEVEL SECURITY

Implement appropriate Supabase RLS.

The default behavior should be restrictive.

Public/customer users should be able to retrieve only the store information that is intentionally public.

Owner users should be able to update the settings.

Do not accidentally expose private configuration.

Separate public business information from future private/internal settings where necessary.

---

# 20. PUBLIC DATA ACCESS

The customer storefront needs read access to public store information.

Create a clean public data-access layer.

Do not let every component write its own Supabase query.

For example, centralize access to store settings through an appropriate repository/service/query module.

The goal is:

**Component → Store Settings Data Layer → Supabase**

not:

**Component → random Supabase query**

---

# 21. SINGLE SOURCE OF TRUTH

After Phase 2, components must NOT contain independent copies of:

- Store name
- Logo
- Address
- Phone
- Email
- Social links
- Business hours

Use the centralized store settings data.

If the owner changes the store name, every relevant customer-facing location should update automatically.

---

# 22. LOGIN/SIGNUP INTEGRATION

This is mandatory.

After the Store Settings system is implemented:

Remove static branding from the authentication pages.

The login/signup experience should retrieve:

- Store logo
- Store name
- Tagline where appropriate

from the store settings backend.

The authentication system itself must remain unchanged.

Do not break:

- Email authentication
- Google OAuth
- Facebook OAuth
- Session handling
- Customer routing
- Owner routing

Only replace static branding/business information with dynamic data.

---

# 23. FOOTER INTEGRATION

The footer must become completely database-driven.

It should dynamically display where configured:

- Logo
- Store name
- Tagline
- Address
- Phone
- Email
- WhatsApp
- Social links
- Business hours

Do not display empty social icons.

If a setting is missing, gracefully hide that element rather than displaying:

"undefined"

or placeholder content.

---

# 24. HEADER / NAVIGATION

Where store branding appears in the header/navbar:

Replace static values with the store settings.

The same should apply to:

- Desktop navbar
- Mobile navbar
- Mobile menu
- Any drawer/sidebar branding

---

# 25. CUSTOMER STOREFRONT

Integrate store settings into all existing customer-facing locations where appropriate.

Examples:

- Homepage
- Footer
- Contact section
- Pickup/location section
- Login
- Signup
- Navigation
- Store information areas

Do not create duplicate hardcoded business information.

---

# 26. SEO / METADATA

Integrate store settings into application metadata where technically appropriate.

Use database-driven values for:

- Site title
- Store name
- Description
- Open Graph title
- Open Graph description
- Favicon where supported

Be careful with caching.

If the owner changes the store name or description, the application should eventually reflect the new metadata according to the application's revalidation strategy.

Do not turn every metadata operation into unnecessary client-side JavaScript.

---

# 27. CACHE & REVALIDATION

Design a sensible caching strategy.

Store settings are relatively infrequently changed but widely consumed.

Avoid querying Supabase independently on every small UI component if it can be safely centralized.

After owner updates settings:

- Revalidate affected pages
- Refresh relevant data
- Ensure login/signup branding updates
- Ensure footer updates
- Ensure customer storefront updates

Do not require redeployment for normal store-setting changes.

---

# 28. FAILURE HANDLING

The customer-facing application must remain usable if the settings query temporarily fails.

However, do not silently revert to outdated hardcoded store information.

Use an appropriate:

- Loading state
- Neutral fallback
- Error boundary
- Retry mechanism

depending on the context.

Authentication functionality must not become dependent on successful loading of optional decorative store settings.

For example:

If the logo fails to load, login should still work.

---

# 29. DATA INTEGRITY

Add appropriate:

- Primary key
- Unique constraints
- NOT NULL constraints where appropriate
- Check constraints
- Timestamp fields

Include:

- created_at
- updated_at

Update timestamps reliably.

Prevent accidental duplicate singleton settings records.

---

# 30. AUDITABILITY

Prepare the settings model for future auditing.

At minimum retain:

- Created timestamp
- Updated timestamp

Where appropriate, prepare the architecture so a future phase can track:

- Who changed a setting
- What changed
- When it changed

Do not build a complete audit-log system unless necessary for this phase.

---

# 31. SECURITY

Perform a security review specifically around business settings.

Check for:

- Unauthorized updates
- Customer privilege escalation
- RLS bypass
- Storage upload abuse
- Malicious URLs
- XSS through store descriptions
- Unsafe HTML rendering
- File upload vulnerabilities
- Oversized uploads
- MIME-type spoofing
- Open redirects

Never render owner-provided content as raw HTML unless absolutely necessary and properly sanitized.

---

# 32. PERFORMANCE

Do not create excessive database requests.

The store settings are global application data.

Use an efficient retrieval strategy appropriate for Next.js.

Avoid:

- Fetching settings separately in every component
- Duplicate Supabase queries
- Unnecessary client-side requests
- Large logo downloads
- Repeated image transformations

---

# 33. TYPES

Create strong TypeScript types for the store settings model.

The database representation and application representation should remain consistent.

Avoid:

- `any`
- loosely typed settings objects
- stringly typed configuration
- duplicated interfaces

Generate or maintain database types using the project's established Supabase type-generation workflow where appropriate.

---

# 34. TESTING

Add tests for:

### Database

- Settings record creation
- Singleton behavior
- Public read permissions
- Owner update permissions
- Customer update rejection

### Server

- Owner authorization
- Customer authorization failure
- Validation
- Store settings retrieval
- Store settings update

### UI

- Settings form rendering
- Form validation
- Saving state
- Error state
- Successful update
- Logo upload
- Logo replacement
- Unsaved changes

### Integration

Verify:

Owner changes store name

→ Database updates

→ Customer-facing components retrieve new value

→ Login/signup displays new store name

→ Footer displays new store name

→ Header displays new store name

No stale static values should remain.

---

# 35. REMOVE MOCK / DEMO DATA

Perform another repository-wide search after implementation.

There must be no remaining dummy/static:

- Store name
- Logo
- Address
- Phone
- Email
- Social links
- Business hours

in production application code.

Test fixtures may contain controlled test values if clearly isolated from production code.

---

# 36. DOCUMENTATION

Update project documentation.

Document:

### Store Settings Architecture

Explain:

- Database model
- Public/private data
- RLS
- Storage
- Data access layer
- Caching/revalidation

### Owner Guide

Explain how the owner can change:

- Store name
- Logo
- Address
- Contact details
- Social links
- Business hours
- Pickup information
- Store status

### Developer Guide

Explain:

- Where store settings are defined
- How components consume them
- How to add future settings
- How storage is handled
- How authorization works

---

# 37. CI / QUALITY CHECKS

After implementation run:

- Formatting
- ESLint
- TypeScript typecheck
- Unit tests
- Integration tests
- E2E tests where applicable
- Production build

Do not suppress errors merely to make the build pass.

Fix the underlying issues.

---

# 38. REGRESSION TEST

Phase 1 must remain fully functional.

Explicitly verify:

### Customer

- Signup still works
- Login still works
- Google OAuth still works
- Facebook OAuth still works
- Logout still works
- Customer route still works

### Owner

- Owner login still works
- Owner route still works
- Owner authorization still works

The Store Settings implementation must not introduce authentication regressions.

---

# 39. FUTURE-PHASE COMPATIBILITY

Design the Store Settings system so future phases can consume it.

Future functionality will likely require:

- Products
- Categories
- Offers
- Orders
- Payments
- Pickup scheduling
- Customer notifications
- Invoices
- WhatsApp communication
- Email notifications

Do not implement these now.

However, Store Settings should be designed so these future systems can consume the same centralized business information.

---

# 40. DEFINITION OF DONE

Phase 2 is complete only when:

### Database

- Store settings table exists.
- Singleton behavior is enforced.
- Appropriate constraints exist.
- Timestamps work.
- RLS is implemented.

### Owner

- Owner can access Store Settings.
- Owner can edit all supported settings.
- Owner can upload/replace logo.
- Owner can save changes.
- Validation works.
- Errors are handled.
- Unauthorized users cannot modify settings.

### Customer

- Customer storefront uses database-driven store information.
- Login uses database-driven store information.
- Signup uses database-driven store information.
- Header uses database-driven branding.
- Footer uses database-driven information.
- Location/contact information uses database data.
- Social links are dynamic.
- Business hours are dynamic.

### Static Data

No production hardcoded store identity remains.

### Security

- RLS works.
- Owner authorization works.
- Storage is protected appropriately.
- Uploaded content is validated.
- No secrets are exposed.

### Quality

- Typecheck passes.
- Lint passes.
- Tests pass.
- Production build passes.
- Documentation is updated.
- Phase 1 authentication remains functional.

---

# 41. FINAL VALIDATION SCENARIO

Perform this exact end-to-end test:

1. Login as owner.
2. Open Store Settings.
3. Change store name.
4. Change logo.
5. Change address.
6. Change phone.
7. Change email.
8. Change WhatsApp.
9. Change Instagram.
10. Change Facebook.
11. Change business hours.
12. Change pickup information.
13. Save.

Then verify:

Customer homepage

→ new store information.

Login page

→ new logo/name.

Signup page

→ new logo/name.

Header

→ new branding.

Footer

→ new information.

Location section

→ new address.

Social icons

→ new URLs.

Business hours

→ new hours.

Then reload the application completely and verify the data persists.

Finally:

- Log out.
- Log back in.
- Verify owner authentication still works.
- Verify customer authentication still works.
- Verify unauthorized users cannot modify settings.

---

# 42. FINAL ENGINEERING REPORT

When finished, report:

## Implementation

Exactly what was built.

## Database

Tables, columns, constraints and RLS policies.

## Storage

Bucket configuration and access model.

## Frontend

Where dynamic store information was integrated.

## Static Data Removal

List the categories of hardcoded data removed.

## Security

Authorization, RLS, validation and upload protections.

## Testing

Actual results for:

- Unit tests
- Integration tests
- E2E tests
- Lint
- Typecheck
- Build

## Documentation

Files updated/created.

## CI/CD

Any changes made.

## Manual Configuration

Anything still requiring Supabase dashboard/deployment configuration.

## Known Limitations

Only real limitations.

## Phase 3 Readiness

Explain whether the Store Settings foundation is ready for the next phase.

---

# MOST IMPORTANT RULE

**Do not simply build a settings form.**

This phase is about establishing the bakery's **centralized business identity architecture**.

The final architecture must be:

Owner Dashboard

→ Store Settings

→ Supabase PostgreSQL / Storage

→ Centralized Store Settings Data Layer

→ Customer Storefront / Login / Signup / Header / Footer / Location / Metadata

There must be **one source of truth**.

If the owner changes the store name once, the entire application should know about the new store name without a developer touching the code.

Before implementation, audit the existing application thoroughly.

Remove static store identity first.

Then implement the database.

Then implement the owner settings UI.

Then connect every existing consumer.

Then test the complete data flow.

Then perform security, performance, accessibility and regression reviews.

Do not proceed to the next commerce feature until Phase 2 passes all validation criteria.
