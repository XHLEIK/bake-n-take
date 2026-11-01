Redesign the existing Bake n Take login/signup experience to a **production-quality, premium bakery UI**.

I have provided screenshots of the current login and signup pages. Treat them as the **current-state visual reference** and critically evaluate what should be improved rather than simply restyling the existing layout.

## IMPORTANT — USE THE INSTALLED DESIGN SKILLS

Before making any UI changes:

1. Read and use the **Taste skill** installed inside:
   `.agents`

2. Read and use the **UI/UX Pro skill** installed inside:
   `.opencode/skills`

3. Apply the principles from both skills throughout the redesign.

Do not produce generic AI-generated UI. The result should look like it was designed by an experienced **product designer + frontend engineer** for a real premium bakery business.

---

# PRIMARY DESIGN DIRECTION

The current split-screen login/signup design should be substantially redesigned.

### Remove/rethink:

- The large 50/50 split-screen marketing panel.
- Excessive diagonal background patterns.
- Large empty areas.
- Oversized "By Sudipta" marketing section.
- Excessive decorative icons.
- Generic AI-dashboard styling.
- Excessive borders and boxed sections.
- Cramped form positioning.
- Unnecessary visual noise.
- The feeling that the form is attached to a dashboard rather than a bakery storefront.

The authentication experience should feel:

**Warm · Calm · Premium · Minimal · Cozy · Elegant · Trustworthy · Modern**

Think of a contemporary boutique bakery rather than a SaaS admin panel.

---

# 1. CENTER THE AUTHENTICATION EXPERIENCE

The login and signup forms must be **properly centered in the viewport**.

Do not place the form against the left or right edge.

Use a carefully constrained content width.

The page should have:

- Balanced horizontal whitespace.
- Balanced vertical spacing.
- A comfortable maximum form width.
- Strong visual hierarchy.
- Excellent readability.

The authentication card/container should NOT look like a heavy floating dashboard card.

Prefer a refined, almost editorial layout with subtle separation/depth rather than a giant bordered rectangle.

---

# 2. BRANDING

Use the existing dynamic store settings system.

The following must remain dynamic:

- Store logo
- Store name
- Owner/store identity where currently supported

Do NOT hardcode:

- "Bake n Take"
- "By Sudipta"
- Logo URLs
- Store information

If store settings already provide these values, continue using them.

The authentication page should feel branded without overwhelming the user with branding.

---

# 3. VISUAL STYLE

Use a refined bakery-inspired palette.

Prefer:

- Warm cream
- Soft ivory
- Muted beige
- Warm brown
- Cocoa/espresso
- Subtle caramel/golden accent

Avoid:

- Excessively dark UI
- Extremely saturated orange
- Neon colors
- Excessive gradients
- Glassmorphism everywhere
- Huge shadows
- Excessive blur

The result should feel like:

> premium bakery packaging + modern editorial web design

rather than:

> AI-generated SaaS dashboard.

---

# 4. TYPOGRAPHY

Create a strong typography hierarchy.

Use:

- One refined display/accent treatment for important branding/headings where appropriate.
- One highly readable UI font for form controls/body text.

Do not use too many fonts.

Headings should feel elegant and confident.

Supporting text should be subtle and readable.

Labels should be compact and clear.

Avoid giant headings that consume unnecessary viewport space.

---

# 5. LOGIN PAGE

Create a refined hierarchy similar to:

**Brand**

Welcome back

Sign in to continue to your account.

↓

Email

Password

Forgot password?

↓

Sign in

↓

OR

Google Facebook

↓

Don't have an account? Create an account

↓

Bakery owner? Owner sign-in

Do not blindly copy this structure if the existing functionality requires something different. Preserve all existing functionality.

---

# 6. SIGNUP PAGE

Use the same visual language as login.

Hierarchy should be clean:

**Brand**

Create your account

A short, useful supporting sentence.

↓

Name

Email

Phone

Password

Password requirements

↓

Create account

↓

OR

Google Facebook

↓

Already have an account? Sign in

Do not make the signup form unnecessarily long or visually dense.

---

# 7. FORM DESIGN

Improve every form control.

Inputs should have:

- Comfortable height.
- Excellent spacing.
- Clear labels.
- Subtle borders.
- Refined focus states.
- Clear placeholder text.
- Proper icons only where genuinely useful.
- Excellent keyboard accessibility.

Do not put unnecessary icons inside every field just because icons are available.

The form should breathe.

---

# 8. BUTTON DESIGN

Primary buttons should feel premium but understated.

Use:

- Strong contrast.
- Comfortable height.
- Subtle hover transition.
- Clear disabled/loading state.
- Proper focus state.

Avoid:

- Giant buttons.
- Excessive gradients.
- Excessive shadows.
- Over-animation.

Google and Facebook buttons should feel secondary but polished.

---

# 9. ANIMATION

Use tasteful motion.

Good examples:

- Subtle page entrance.
- Gentle form transition.
- Button hover.
- Input focus transition.
- Password visibility transition.
- OAuth loading state.

Avoid:

- Floating everything.
- Bouncing elements.
- Excessive parallax.
- Constant animations.
- Distracting background movement.

Motion should communicate interaction, not exist merely to demonstrate animation.

Respect:

`prefers-reduced-motion`

---

# 10. BACKGROUND

Replace the current aggressive diagonal pattern.

Use a much more refined background.

Possible direction:

- Warm neutral background.
- Extremely subtle texture.
- Very subtle gradient/radial lighting.
- Minimal bakery-inspired visual treatment.

The background must remain quiet enough that the authentication form is the primary focus.

Do not use random decorative blobs or generic AI-generated shapes.

---

# 11. LOGO / BRAND POSITION

Position the store logo and name naturally.

Do not make the logo unnecessarily tiny.

Do not make the branding dominate the page.

A clean top-centered or upper-content brand treatment is preferred.

Maintain enough whitespace around it.

---

# 12. OWNER LOGIN

Keep the owner login functionality.

The owner login entry should be visually secondary:

> Bakery owner? Sign in here

It should not compete with the customer authentication CTA.

Do not expose unnecessary owner functionality on the customer-facing page.

Preserve the existing owner authentication and authorization logic.

---

# 13. AUTHENTICATION STATES

Do not redesign only the happy state.

Professionally design:

- Loading
- Invalid email
- Invalid password
- Incorrect credentials
- Validation errors
- Password requirements
- OAuth loading
- OAuth failure
- Signup success
- Email verification state if applicable
- Signed-out notice
- Network error
- Rate-limit/error state
- Disabled submit button

Errors should be:

- Clear.
- Human-readable.
- Calm.
- Positioned close to the relevant content.
- Accessible.

Do not expose sensitive backend/authentication information.

---

# 14. LOGIN / SIGNUP TRANSITION

The transition between:

- Login
- Signup
- Forgot Password
- Owner Login

should feel intentional and consistent.

Avoid unnecessary full-page reloads if the existing routing architecture supports a better transition.

Do not break existing URLs or authentication flows.

---

# 15. RESPONSIVE DESIGN

This is extremely important.

Do NOT simply collapse the current desktop layout into mobile.

Design mobile intentionally.

On mobile:

- Authentication content should remain centered.
- Form should use the available width intelligently.
- Horizontal padding should be comfortable.
- Branding should remain visible.
- Buttons should remain easy to tap.
- No horizontal overflow.
- No awkward oversized whitespace.
- No tiny text.
- No clipped decorative elements.

Test common viewport sizes.

---

# 16. ACCESSIBILITY

Ensure:

- Proper semantic HTML.
- Labels associated with inputs.
- Keyboard navigation.
- Visible focus states.
- Screen-reader-friendly errors.
- Appropriate ARIA only where necessary.
- Sufficient color contrast.
- Reduced-motion support.
- Proper button semantics.
- Password visibility control accessible by keyboard.

---

# 17. RESPONSIBLE USE OF ICONS

Use the existing icon library/design system.

Do not add icons merely for decoration.

Icons should improve comprehension.

Keep icon sizing and stroke weight consistent.

---

# 18. PRESERVE ALL FUNCTIONALITY

This is a UI/UX redesign, NOT an authentication rewrite.

Do not break:

- Supabase authentication.
- Email/password login.
- Signup.
- Google OAuth.
- Facebook OAuth.
- Forgot password.
- Session handling.
- Customer routing.
- Owner routing.
- Owner authentication.
- Dynamic store settings.
- Existing validation.
- Existing security.
- Existing error handling.

If a visual change requires modifying a component, preserve its behavior.

---

# 19. DO NOT CREATE AI SLOP

Before considering the redesign complete, specifically check for:

- Excessive rounded rectangles.
- Excessive cards.
- Excessive gradients.
- Excessive shadows.
- Random floating shapes.
- Too many icons.
- Huge headings.
- Generic SaaS language.
- Excessive animation.
- Unnecessary decorative elements.
- Poor whitespace rhythm.
- Visually competing elements.

Every visual element should have a reason to exist.

---

# 20. USE THE EXISTING DESIGN SYSTEM

Before adding new CSS/components:

- Inspect existing tokens.
- Inspect Tailwind configuration.
- Inspect existing UI components.
- Inspect typography.
- Inspect color variables.
- Inspect spacing conventions.
- Inspect existing button/input components.

Extend the design system instead of creating inconsistent one-off styles.

---

# 21. FINAL VISUAL GOAL

The finished authentication page should feel like:

> A real premium local bakery website that happens to have authentication.

NOT:

> A developer demo.
>
> A SaaS dashboard.
>
> An AI-generated landing page.
>
> A template with bakery text inserted into it.

The customer should immediately feel that the website is trustworthy, warm and professionally designed.

---

# 22. IMPLEMENTATION PROCESS

Follow this process:

### Step 1

Inspect the existing login/signup implementation.

### Step 2

Read the Taste skill.

### Step 3

Read the UI/UX Pro skill.

### Step 4

Inspect the existing design system and reusable components.

### Step 5

Analyze the supplied screenshots and identify the current UX problems.

### Step 6

Create the new visual direction.

### Step 7

Implement login.

### Step 8

Implement signup using the same design system.

### Step 9

Ensure forgot password, OAuth, validation and owner-login entry remain functional.

### Step 10

Implement responsive behavior.

### Step 11

Run normal checks:

- TypeScript/typecheck
- ESLint
- Formatting
- Production build

Fix any issues introduced by the redesign.

---

# IMPORTANT FINAL REQUIREMENT

Do not simply make the existing UI "prettier".

**Reconsider the composition.**

The biggest change should be the overall visual hierarchy and layout:

- Centered authentication experience.
- Quiet premium background.
- Minimal branding.
- Strong typography.
- Excellent whitespace.
- Refined controls.
- Calm bakery aesthetic.
- No unnecessary split-screen marketing panel.

Use the supplied screenshots as evidence of what currently exists, and use the installed **Taste** and **UI/UX Pro** skills to determine how to transform it into a genuinely professional interface.

Before finishing, compare the new implementation against the screenshots and perform a final UI/UX quality pass for spacing, hierarchy, responsiveness, accessibility and visual consistency.

Do the implementation yourself; do not merely provide recommendations.
