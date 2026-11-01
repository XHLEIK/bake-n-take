REDESIGN /owner/settings — BAKE N TAKE STORE SETTINGS

Read and follow this task carefully. The target page is:

http://localhost:3000/owner/settings

I have provided multiple screenshots of the current Store Settings page. Treat the screenshots as the CURRENT implementation, not the desired final design.

You have full frontend/UX design authority.

First deeply inspect the repository and the actual /owner/settings implementation. Use /graphify first if available, then use the relevant design skills:

- /ui-ux-pro-max
- /frontend-taste
- /taste
- UI Skills MCP
- any other relevant frontend/design skill available

Do NOT start coding before understanding the existing implementation.

==================================================
PRIMARY GOAL
==================================================

Redesign the entire Store Settings experience into a polished, intuitive, production-quality settings workspace.

The current page has too many options presented as one long sequence of similarly weighted cards. It forces the owner to continuously scroll and makes unrelated settings feel equally important.

FIX THE INFORMATION ARCHITECTURE.

IMPORTANT:

DO NOT REMOVE ANY EXISTING CUSTOMIZATION OPTION.

Every existing setting, field, toggle, upload, banner option, business-hour control, social option, regional option, About Us option, pickup option, etc. must remain available.

We are changing HOW the settings are organized and presented, not removing functionality.

==================================================
CURRENT SETTINGS THAT MUST REMAIN AVAILABLE
==================================================

Audit the actual implementation and preserve every existing setting.

The screenshots show settings including:

- Store name
- Tagline
- Description
- Store logo
- Primary phone
- Secondary phone
- Email
- WhatsApp number
- Address line 1
- Address line 2
- Locality / area
- City
- State
- PIN code
- Country
- Google Maps URL
- Latitude
- Longitude
- Business hours for every day
- Instagram URL
- Facebook URL
- WhatsApp link
- Additional social platforms
- Pickup instructions
- Pickup location
- Preparation time note
- Pickup notes
- Store open
- Accepting orders
- Status message
- Maximum hero slides
- About Us visibility
- About Us eyebrow
- About Us CTA
- About Us heading
- About Us body
- Homepage banner selection
- Default banner images
- Custom banner upload
- Currency code
- Currency symbol
- Timezone

There may be additional fields in the actual code.

DO NOT rely only on this list.

Inspect the real implementation and preserve ALL existing functionality.

==================================================
NEW INFORMATION ARCHITECTURE
==================================================

Organize the settings into logical categories.

Recommended structure:

GENERAL

- Store identity
- Brand images

CONTACT & LOCATION

- Contact information
- Store address
- Map/location

OPERATIONS

- Business hours
- Pickup information
- Store availability/status

STOREFRONT

- Homepage highlights/banner
- About Us

SOCIAL

- Social profiles and communication links

REGIONAL

- Currency
- Timezone

You may refine the grouping if your repository inspection reveals a better information architecture.

Do NOT blindly follow the categories if actual functionality suggests a better grouping.

The goal is maximum clarity with minimum cognitive load.

==================================================
SETTINGS NAVIGATION
==================================================

Do NOT keep the entire page as one giant uninterrupted form.

Create a clear settings navigation/index inside the Store Settings workspace.

The user should be able to quickly jump between:

- General
- Contact & Location
- Operations
- Storefront
- Social
- Regional

Use a familiar settings pattern.

Do NOT create another permanent global sidebar.

The existing ADMIN sidebar remains the primary application navigation.

The Store Settings navigation is only contextual navigation inside this page.

On desktop, use an elegant secondary settings navigation/index.

On mobile, adapt it intelligently into a compact navigation pattern such as a section selector, drawer, or other appropriate responsive pattern.

Do not simply shrink the desktop layout.

==================================================
PAGE STRUCTURE
==================================================

The final experience should conceptually become:

ADMIN SIDEBAR
↓
ADMIN HEADER
↓
STORE SETTINGS
↓
Settings navigation + settings content

The Store Settings page should have a concise page header.

Avoid unnecessary repetition such as:

OWNER CONSOLE
Store settings
Store Settings

Do not repeat information already established by the global admin shell.

Use a concise description such as:

"Manage how your bakery appears, operates and communicates with customers."

Use your own improved copy if appropriate.

==================================================
DESIGN PRINCIPLES
==================================================

Apply these principles throughout the redesign:

- Jakob's Law
- Fitts's Law
- Hick's Law
- Miller's Law
- Gestalt principles
- Law of Proximity
- Law of Similarity
- Common Region
- Recognition over Recall
- Progressive Disclosure
- Consistency and Standards
- Visibility of System Status
- User Control and Freedom
- Error Prevention
- Aesthetic-Usability Effect
- Tesler's Law
- accessibility-first design

Do not mechanically mention these laws in the interface.

Use them to make actual UX decisions.

==================================================
REDUCE COGNITIVE LOAD
==================================================

The current page exposes too many decisions simultaneously.

Fix this through:

- meaningful grouping
- hierarchy
- contextual navigation
- sensible spacing
- progressive disclosure
- better field layouts
- concise helper text
- clear labels
- appropriate visual density

Do NOT solve the problem by hiding everything inside dozens of accordions.

Settings should remain discoverable.

The user should be able to understand where a setting belongs without memorizing the interface.

==================================================
FORM DESIGN
==================================================

Improve the form layout substantially.

Use appropriate multi-column layouts for related short fields.

Examples:

Primary phone Secondary phone
[_**********] [**********_]

Email WhatsApp
[_**********] [**********_]

For long content:

Description
[--------------------------------]

Do not make every field unnecessarily full-width.

Do not make every field excessively tall.

Maintain comfortable touch targets.

Use consistent:

- labels
- field heights
- spacing
- helper text
- focus states
- validation states
- icons

==================================================
PROGRESSIVE DISCLOSURE
==================================================

Use progressive disclosure for genuinely advanced configuration.

For example:

Store address

- normal address fields visible

Advanced map location

- Google Maps URL
- Latitude
- Longitude

Do NOT remove these fields.

Simply make advanced configuration less visually dominant.

Apply the same principle wherever appropriate.

==================================================
BUSINESS HOURS
==================================================

Redesign the weekly business-hours interface.

The current seven large repeated cards create unnecessary visual repetition.

Create a compact, highly readable weekly schedule.

Every day must remain configurable:

- enabled/closed
- opening time
- closing time

Maintain accessible controls and touch-friendly interaction.

Do not turn it into an unusable dense spreadsheet.

Find the right balance between density and readability.

==================================================
CONTACT & LOCATION
==================================================

Improve the information hierarchy.

Separate conceptually:

CONTACT

- Primary phone
- Secondary phone
- Email
- WhatsApp

ADDRESS

- Address line 1
- Address line 2
- Locality
- City
- State
- PIN
- Country

MAP

- Google Maps URL
- Latitude
- Longitude

Do not change the underlying data model unless absolutely necessary.

==================================================
PICKUP SETTINGS
==================================================

Make the difference between:

- Pickup location
- Preparation time note
- Pickup instructions
- Pickup notes

immediately understandable.

The current labels are too similar.

Use better owner-facing descriptions/helper text where appropriate.

Do not remove or merge fields unless the actual business logic proves they are duplicates.

==================================================
STORE STATUS
==================================================

Improve the hierarchy of:

- Store open
- Accepting orders
- Status message

Make it immediately obvious that these are separate operational controls.

Use clear explanations written for a bakery owner, not a developer.

Avoid technical wording such as "backend capability".

==================================================
STOREFRONT SETTINGS
==================================================

Organize homepage-related configuration together.

This should include:

- maximum hero slides
- banner selection
- custom banner
- About Us visibility
- About Us content

The current banner selector should make the CURRENT selection immediately obvious.

The selected banner must have a strong accessible visual state.

Custom banner upload should clearly communicate:

- supported file types
- maximum size
- current image
- replace/remove behavior

Preserve all existing functionality.

==================================================
ABOUT US
==================================================

Organize:

- visibility
- eyebrow
- heading
- body
- CTA label

into a clear content-editing experience.

The owner should immediately understand that these values control the homepage About section.

Avoid technical implementation descriptions.

==================================================
REGIONAL SETTINGS
==================================================

Keep:

- Currency code
- Currency symbol
- Timezone

but give them appropriate lower visual priority.

They can be presented as advanced/store-wide configuration.

Do not remove them.

==================================================
SAVE EXPERIENCE — IMPORTANT
==================================================

The current sticky Save Settings bar is one of the biggest UX problems.

It currently overlaps content.

FIX THIS COMPLETELY.

The save system should communicate state clearly.

When there are NO unsaved changes:

Show a subtle state such as:

✓ All changes saved

Do not show a huge dominant save bar unnecessarily.

When there ARE unsaved changes:

Show a restrained sticky action bar containing:

Unsaved changes

Reset changes

Save changes

The bar must:

- never cover form content
- remain within the correct content boundary
- have appropriate spacing
- not dominate the screen
- have accessible focus behavior
- work on mobile
- clearly communicate unsaved state

Preserve the existing save/reset functionality.

Do not break persistence.

==================================================
OWNER-FACING LANGUAGE
==================================================

Audit all helper text and descriptions.

Remove unnecessary developer terminology.

Avoid phrases such as:

- backend capability
- metadata
- future ordering
- implementation-specific descriptions

Use clear owner-facing language.

Example:

Instead of:

"Backend capability for future ordering — today it drives the storefront banner."

Use something like:

"Control whether your bakery is open and accepting orders."

Do this wherever appropriate.

Do not change business meaning.

==================================================
CARD / CONTAINER DESIGN
==================================================

Reduce "card fatigue".

The current page contains too many visually identical large cards.

Do not put every tiny group inside another rounded card.

Use:

- meaningful section containers
- subtle dividers
- spacing
- typography
- grouping

Cards should communicate actual grouping, not simply surround every form.

Avoid excessive:

- borders
- shadows
- rounded containers
- gradients
- glow
- decorative elements

==================================================
VISUAL DESIGN
==================================================

The admin must match the existing Bake n Take storefront.

Reuse the established:

- espresso/chocolate background
- warm cream typography
- muted bakery colors
- amber/gold accent
- typography
- radii
- borders
- iconography
- theme behavior

Do NOT introduce a generic SaaS blue dashboard.

Do NOT redesign the brand.

Do NOT make the settings page visually disconnected from the storefront.

The final result should feel premium, calm, warm and professional.

==================================================
RESPONSIVE DESIGN
==================================================

Audit and redesign the entire page for:

320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px

On mobile:

- no horizontal scrolling
- no clipped fields
- no overlapping save bar
- no broken settings navigation
- no tiny controls
- no unusable multi-column layouts

Collapse fields intelligently.

Maintain logical grouping.

The settings navigation must remain easy to use.

==================================================
ACCESSIBILITY
==================================================

Target WCAG-oriented accessibility.

Ensure:

- semantic headings
- semantic forms
- associated labels
- keyboard navigation
- visible focus
- sufficient contrast
- accessible toggles
- accessible image upload
- accessible banner selection
- correct aria attributes
- logical tab order
- error messages associated with fields
- accessible mobile navigation
- reduced motion support

Do not rely only on color to communicate state.

==================================================
DYNAMIC DATA
==================================================

Preserve the existing dynamic store settings architecture.

Do NOT hardcode:

- store name
- owner name
- logo
- contact information
- address
- hours
- social links
- banner information
- About content
- regional settings

The UI must continue reading/writing the existing data source.

==================================================
DO NOT BREAK FUNCTIONALITY
==================================================

Do NOT change unnecessarily:

- Supabase
- authentication
- authorization
- database schema
- RLS
- server actions
- APIs
- save logic
- image upload logic
- store settings persistence
- existing business logic

If the frontend requires an architectural adjustment, make the smallest safe change.

==================================================
IMPLEMENTATION PROCESS
==================================================

Follow:

INDEX
→ UNDERSTAND
→ AUDIT
→ DESIGN
→ IMPLEMENT
→ TEST
→ VISUAL QA

1. Index the repository with /graphify.
2. Inspect the actual /owner/settings code.
3. Map EVERY existing setting to the new information architecture.
4. Inspect existing storefront design tokens/components.
5. Use /ui-ux-pro-max, /frontend-taste, /taste and UI Skills MCP.
6. Design the new settings architecture.
7. Implement it.
8. Verify every existing setting is still accessible.
9. Verify save/reset/persistence.
10. Test responsive behavior.
11. Test accessibility.
12. Run typecheck.
13. Run lint.
14. Run relevant tests.
15. Run production build.
16. Fix all issues introduced by the redesign.

==================================================
NON-NEGOTIABLE
==================================================

DO NOT:

- remove settings
- remove customization options
- remove existing business functionality
- create fake settings
- create fake data
- duplicate settings
- create a second global sidebar
- use generic SaaS styling
- hide everything behind accordions
- create unnecessary tabs
- introduce excessive animations
- introduce unnecessary dependencies
- break mobile
- break saving
- break authentication
- change the database unnecessarily

==================================================
FINAL SELF-REVIEW
==================================================

Before finishing, review the page as BOTH:

1. A senior product designer
2. A bakery owner who is not a developer

Ask:

Can I immediately find my store name?

Can I find my phone number?

Can I change Sunday hours quickly?

Can I change my address without confusion?

Can I update my homepage banner?

Can I edit About Us?

Can I understand store open vs accepting orders?

Can I find regional settings?

Can I tell whether my changes are saved?

Can I navigate the page without remembering where things are?

Does anything feel unnecessarily complicated?

Does anything look like a developer/admin template?

Does anything still feel like one giant form?

Does anything overlap?

Does the mobile experience work properly?

Does every existing customization option still exist?

Fix anything that fails this review.

==================================================
DEFINITION OF DONE
==================================================

The redesign is complete only when:

✓ Every existing setting remains available.

✓ Settings are logically grouped.

✓ The page is no longer one overwhelming continuous form.

✓ A clear contextual settings navigation exists.

✓ The global admin sidebar remains the primary application navigation.

✓ The save experience is clear and never covers content.

✓ Advanced settings use sensible progressive disclosure.

✓ Business hours are compact and easy to understand.

✓ Contact/location settings have clear hierarchy.

✓ Pickup settings are understandable.

✓ Store status is understandable.

✓ Storefront/banner/About settings are logically grouped.

✓ Regional settings have appropriate visual priority.

✓ Owner-facing copy is clear and non-technical.

✓ The page matches the Bake n Take visual identity.

✓ No generic SaaS styling is introduced.

✓ Desktop, tablet and mobile are polished.

✓ Keyboard and accessibility behavior is correct.

✓ Existing persistence and functionality work.

✓ Typecheck passes.

✓ Lint passes.

✓ Tests pass.

✓ Production build passes.

✓ No unnecessary dependencies are introduced.

Most importantly:

DO NOT JUST MAKE THE CURRENT PAGE LOOK PRETTIER.

RETHINK THE INFORMATION ARCHITECTURE AND USER EXPERIENCE.

The goal is to transform Store Settings from a long, confusing configuration form into a clear, familiar, professional settings workspace while preserving 100% of the existing customization capability.
