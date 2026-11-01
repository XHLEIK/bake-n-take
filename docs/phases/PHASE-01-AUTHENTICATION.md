# PROJECT: BAKE N TAKE — PHASE 1

## ROLE

Act as a **senior staff-level full-stack engineer, frontend engineer, backend engineer, UI/UX designer, security engineer, QA engineer, DevOps engineer, technical architect, and technical documentation writer** working on a production client project.

Do not behave like a code generator.

Think, inspect, plan, implement, test, review, document, and validate like an experienced professional freelancer delivering a real commercial application to a paying client.

The project is being built from scratch, so establish strong engineering foundations now rather than creating shortcuts that will become technical debt later.

---

# PHASE 1 OBJECTIVE

The only functional feature being delivered in this phase is the **authentication foundation**.

Build and validate:

1. Customer signup/login
2. Customer logout
3. Customer session persistence
4. Customer email/password authentication
5. Customer Google OAuth
6. Customer Facebook OAuth
7. Owner authentication
8. Owner authorization
9. Secure role-based routing
10. Protected customer placeholder page
11. Protected owner placeholder page
12. Supabase Auth integration
13. Supabase PostgreSQL user/profile foundation
14. Secure session management
15. RLS and authorization foundation
16. Testing foundation
17. Documentation foundation
18. CI/CD foundation
19. Production-quality frontend authentication UI
20. Security and code-quality validation

Do NOT implement products, offers, ordering, payments, carts, quotations, WhatsApp ordering, or other Phase 2+ functionality.

The goal is to make Phase 1 exceptionally solid before expanding the application.

---

# 1. FIRST: INSPECT BEFORE MODIFYING

Before writing code, inspect the entire repository.

Understand:

- Current framework
- Next.js version
- React version
- TypeScript configuration
- Tailwind configuration
- shadcn/ui configuration
- Existing components
- Existing routes
- Existing package manager
- Existing linting
- Existing formatting
- Existing testing
- Existing environment configuration
- Existing Git configuration
- Existing CI/CD configuration
- Existing Supabase configuration
- Existing documentation

Do not blindly overwrite existing project configuration.

Identify what is reusable and what should be replaced.

Before implementation, produce a concise internal Phase 1 architecture plan based on the actual repository state.

Do not assume the repository matches a generic Next.js template.

---

# 2. ENGINEERING SKILLS

Before implementing the feature, inspect the available AI-agent skills and determine which skills are actually useful for this project.

Prioritize skills related to:

### Project/context efficiency

- Graphify or the project's available graph-based code indexing/context skill
- Efficient repository understanding
- Dependency/context minimization

### Code efficiency

- Ponytail or the project's available minimal/efficient-code skill
- DRY architecture
- Small reusable modules
- Avoiding unnecessary abstractions

### Frontend

- Taste / frontend design skills
- UI/UX design
- Responsive design
- Accessibility
- Animation/motion design
- shadcn/ui
- Next.js
- React
- Tailwind

### Backend

- Supabase
- PostgreSQL
- Next.js server architecture
- API/server actions
- Database design

### Security

- Authentication
- Authorization
- OAuth
- Session management
- RLS
- Secure coding
- OWASP practices

### Testing

- Unit testing
- Integration testing
- End-to-end testing
- Authentication testing

### Documentation

- Technical documentation
- Architecture documentation
- API documentation
- Environment/setup documentation
- Security documentation

### DevOps

- Git
- CI/CD
- Build validation
- Deployment readiness

Install the best relevant available skills if the environment supports them.

Do NOT install every available skill blindly.

Only install skills that materially improve this project's development.

For every installed skill, actually use it where relevant.

If a requested skill such as Graphify or Ponytail is not available in the current environment, do not fabricate it. Find the closest available capability and document the substitution.

---

# 3. ENGINEERING WORKFLOW

Follow this workflow strictly:

### STEP 1

Inspect.

### STEP 2

Plan architecture.

### STEP 3

Establish engineering standards.

### STEP 4

Implement the smallest production-quality foundation.

### STEP 5

Write tests alongside the implementation.

### STEP 6

Run static analysis.

### STEP 7

Run tests.

### STEP 8

Run production build.

### STEP 9

Perform security review.

### STEP 10

Perform UI/UX review.

### STEP 11

Perform code-quality review.

### STEP 12

Update documentation.

### STEP 13

Verify Git/CI/CD readiness.

### STEP 14

Only then consider Phase 1 complete.

Never declare the task complete merely because the code was written.

---

# 4. FRONTEND DESIGN DIRECTION

The customer authentication experience must feel like a premium modern bakery brand.

The design direction should be:

- Modern
- Aesthetic
- Cosy
- Calm
- Warm
- Elegant
- Minimal
- Premium
- Trustworthy
- Friendly

Avoid:

- Generic SaaS login screens
- Overly corporate layouts
- Excessive gradients
- Excessive glassmorphism
- Excessive animations
- Huge unnecessary text
- Clutter
- Poor contrast
- Template-looking UI

Use the selected **Nova — Lucide / Geist** shadcn/ui foundation.

Use Lucide icons consistently.

Typography should feel refined and readable.

Use a carefully chosen bakery-oriented color palette.

The interface should look appropriate for a premium local bakery rather than a generic software product.

---

# 5. AUTHENTICATION PAGE

Create a polished authentication experience.

The authentication interface should support:

### Customer

- Login
- Signup
- Email/password
- Google
- Facebook
- Forgot password
- Logout

Use a clean separation between login and registration states.

The signup form should collect only information genuinely required at this stage.

At minimum, establish the customer's:

- Name where appropriate
- Email
- Phone where required/available
- Password

Do not collect unnecessary information.

---

# 6. AUTHENTICATION UX

Every authentication operation must have clear states:

### Idle

Normal form.

### Loading

Show a polished loading state.

Disable duplicate submissions.

### Success

Transition smoothly to the appropriate protected destination.

### Error

Show a human-readable error.

Do not expose:

- Stack traces
- SQL errors
- Internal Supabase errors
- Secrets
- Implementation details

### Network failure

Provide an appropriate retry/recovery experience.

---

# 7. GOOGLE OAUTH

Implement real Google authentication through Supabase Auth.

Do not create a fake Google button.

The complete flow must work:

Customer

→ Click Google

→ Google authentication

→ Supabase callback

→ Secure session establishment

→ Profile creation/retrieval

→ Role determination

→ Customer destination

Use the correct OAuth callback architecture for Next.js.

Use the recommended authorization-code/PKCE approach.

Do not implement the OAuth protocol manually.

---

# 8. FACEBOOK OAUTH

Implement real Facebook authentication through Supabase Auth.

The button must be functional.

Implement:

Facebook

→ OAuth provider

→ Supabase callback

→ Secure session

→ Profile creation/retrieval

→ Role determination

→ Customer destination

Use the same secure callback/session architecture as Google.

Do not create a custom OAuth implementation.

---

# 9. SUPABASE AUTH ARCHITECTURE

Use:

- @supabase/supabase-js
- @supabase/ssr

Use the official Supabase SSR architecture appropriate for Next.js.

Sessions must be available securely to both:

- Server
- Browser/client where necessary

Use cookie-based session handling appropriate for SSR.

Use PKCE for OAuth.

Do not build a second authentication system around Supabase.

Supabase Auth is the authentication authority.

---

# 10. JWT REQUIREMENT

Do NOT create a custom JWT authentication system.

Do NOT:

- Generate your own access tokens
- Store custom JWTs in localStorage
- Put JWTs in URLs
- Build custom password authentication
- Implement a second token system unnecessarily

Use the signed JWT access tokens issued by Supabase Auth.

Validate authentication server-side using the Supabase session/auth APIs.

The application authorization layer should determine what the authenticated user is allowed to do.

JWTs are authentication/session credentials, not something that should be exposed in URLs.

---

# 11. PASSWORD SECURITY

Do not manually store passwords.

Do not create a passwords table.

Do not implement custom password hashing.

Do not implement custom bcrypt authentication.

Supabase Auth must handle password storage and authentication.

The application database should only store the profile/application information necessary for the bakery platform.

---

# 12. USER PROFILE DATABASE

Create a clean application-level profile model linked to the Supabase Auth user.

The model should support:

- Internal user ID
- Supabase Auth user ID
- Name
- Email
- Phone where applicable
- Role
- Account status
- Created timestamp
- Updated timestamp

The Supabase Auth user remains the authentication identity.

The application profile represents the bakery application's user.

Use proper relational constraints.

---

# 13. USER ROLES

At minimum:

### CUSTOMER

Default role for normal registrations.

### OWNER

Privileged role for the bakery owner.

Never allow users to choose their own role during signup.

Never accept a role from the client as authoritative.

Never allow a customer to modify their role.

Role assignment must happen through trusted server/database logic.

---

# 14. OWNER AUTHENTICATION

The owner should be able to authenticate through the appropriate owner login experience.

The owner must use the same underlying Supabase Auth system.

Do not create a separate password database for the owner.

The owner identity should exist as a normal Supabase Auth user with an application-level OWNER role.

Owner authorization must be based on trusted server/database state.

Do not simply check:

"Does this email equal the owner email?"

inside frontend JavaScript.

Email identity and authorization role are separate concepts.

---

# 15. OWNER BOOTSTRAP

Create a safe bootstrap process for the initial owner account.

The initial owner credentials supplied for development/bootstrap must NEVER be hardcoded into frontend code.

Do not commit the owner's password into Git.

Use a secure administrative/bootstrap process or environment-based setup.

After the owner account exists:

- Store the owner role in the application profile.
- Verify the role server-side.
- Allow the owner to authenticate normally.

Do not build a permanent backdoor.

---

# 16. OWNER LOGIN

The owner login interface may be visually distinct from the customer signup experience while using the same authentication infrastructure.

The owner login must:

1. Authenticate using Supabase.
2. Retrieve the authenticated user's application profile.
3. Verify OWNER role.
4. Deny access if the role is not OWNER.
5. Redirect authorized owners to the owner protected route.

A customer attempting to use the owner login must not gain access.

---

# 17. ROUTING

Implement protected routes.

Customer protected destination:

A minimal page displaying:

"Customer"

Owner protected destination:

A minimal page displaying:

"Owner"

These pages are intentionally placeholders.

Do not build the actual customer dashboard or owner dashboard yet.

The routes must nevertheless be fully protected.

---

# 18. URL / USER ID SECURITY

Do not place authentication tokens, passwords, email addresses, or sensitive session information in URLs.

Do not expose the raw Supabase Auth UUID simply because the user requested it.

If a future feature genuinely requires an identifier in the URL:

- Create a separate opaque public identifier.
- Keep the Auth UUID internal.
- Ensure the public identifier cannot be used to bypass authorization.

For this phase, prefer clean routes such as:

Customer protected area:

/customer

Owner protected area:

/owner

The authenticated session determines identity.

---

# 19. AUTHORIZATION

Authentication answers:

"Who are you?"

Authorization answers:

"What are you allowed to access?"

Implement these separately.

Every owner-protected request must verify authorization server-side.

Never rely on:

- Hidden buttons
- Frontend route visibility
- localStorage
- URL parameters
- Client-side role variables

as the actual security boundary.

The database/RLS/server layer must enforce authorization.

---

# 20. ROW LEVEL SECURITY

Implement appropriate Supabase PostgreSQL RLS policies.

The policies must follow least privilege.

Customers should not be able to:

- Modify products
- Modify business settings
- Modify promotions
- Modify another customer's data
- Assign themselves OWNER
- Read privileged owner information

Owner-only data should have appropriate protection.

Default to deny rather than accidentally exposing data.

---

# 21. SESSION SECURITY

Follow secure session-management practices.

Use:

- HTTPS in deployed environments
- Secure cookies
- Appropriate SameSite behavior
- HttpOnly protections where applicable
- Proper session refresh
- Logout/session invalidation
- Server-side authentication checks

Do not store authentication tokens in localStorage unless there is a documented, unavoidable reason.

Follow Supabase's current SSR guidance.

---

# 22. SECURITY HEADERS / HARDENING

Where appropriate for the current Next.js deployment, establish security headers such as:

- Content Security Policy where feasible
- X-Content-Type-Options
- Referrer-Policy
- Frame protection
- Strict-Transport-Security in production
- Appropriate permissions policy

Do not introduce a CSP that breaks legitimate OAuth or application functionality.

Document any security-header decisions.

---

# 23. INPUT VALIDATION

Validate all authentication input.

Handle:

- Email validation
- Password requirements
- Name validation
- Phone validation
- Input length limits
- Unexpected input
- Malformed requests

Never rely only on HTML validation.

Server-side validation must exist wherever data crosses a trust boundary.

---

# 24. RATE LIMITING / ABUSE

Evaluate authentication abuse risks.

At minimum account for:

- Repeated login attempts
- Signup abuse
- OAuth callback abuse
- Password-reset abuse

Use Supabase's available protections where appropriate and document anything that requires external infrastructure or configuration.

Do not build an unnecessarily complex rate-limiting system during Phase 1 if Supabase already provides the appropriate mechanism.

---

# 25. ACCESSIBILITY

Authentication must meet professional accessibility expectations.

Include:

- Proper labels
- Keyboard navigation
- Focus states
- Accessible error messages
- Appropriate form semantics
- Sufficient color contrast
- Screen-reader-friendly status updates
- Reduced-motion consideration

Do not rely on color alone to communicate errors.

---

# 26. RESPONSIVE DESIGN

The authentication experience must work professionally on:

- Mobile
- Tablet
- Laptop
- Desktop

The mobile layout should not simply be a compressed desktop layout.

Design specifically for touch interaction.

---

# 27. ANIMATIONS

Use subtle, purposeful animation.

Examples:

- Page entrance
- Form transitions
- Button loading
- OAuth transition
- Success state
- Error state

Animations must:

- Feel premium
- Remain fast
- Respect reduced-motion preferences
- Never interfere with form usability

Do not add animation simply because a library makes it possible.

---

# 28. ERROR UX

Create clear messages for:

- Invalid credentials
- Existing account
- Weak password
- OAuth failure
- OAuth cancellation
- Email verification requirement
- Password reset failure
- Unauthorized owner access
- Network failure
- Session expiration

Messages should help the user recover without revealing sensitive information.

---

# 29. TESTING STRATEGY

Establish a proper testing foundation.

Use the project's existing testing framework if one exists.

If none exists, choose the smallest professional stack appropriate for:

- Unit tests
- Integration tests
- End-to-end tests

Do not install unnecessary testing frameworks.

---

# 30. TEST CASES

Test at minimum:

### Customer

- Signup
- Login
- Logout
- Invalid login
- Password validation
- Session persistence
- Protected route
- Unauthorized owner route

### OAuth

- Google initiation
- Google callback handling
- Facebook initiation
- Facebook callback handling
- OAuth error handling

### Owner

- Owner login
- Owner authorization
- Customer attempting owner access
- Unauthenticated owner access

### Security

- Role manipulation attempt
- Protected route without session
- Invalid session
- Unauthorized database access

### UI

- Form validation
- Loading states
- Error states
- Keyboard accessibility
- Mobile layout

---

# 31. TEST ENVIRONMENT

Tests must not accidentally modify the production database.

Use appropriate:

- Test environment
- Mocking
- Local Supabase environment
- Dedicated test project

where appropriate.

Never run destructive tests against production data.

---

# 32. STATIC QUALITY CHECKS

Establish and enforce:

- TypeScript strictness
- ESLint
- Formatting
- Import consistency
- Dead-code detection where practical
- Dependency hygiene

Do not silence lint/type errors merely to make CI pass.

Fix the underlying problem.

---

# 33. CODE QUALITY

Follow these principles:

- Small modules
- Strong typing
- Clear naming
- Single responsibility
- Reusable components
- Minimal duplication
- No unnecessary abstractions
- No giant components
- No giant utility files
- No business logic hidden inside UI components
- No secrets in source code
- No hardcoded environment-specific values

Use the Ponytail/minimal-code philosophy if that skill is available:

Write the minimum amount of code required to solve the problem correctly.

Do not confuse minimal code with poorly engineered code.

---

# 34. PROJECT ARCHITECTURE

Establish clear separation between:

### UI

Components and presentation.

### Authentication

Supabase Auth/session functionality.

### Authorization

Role and access-control logic.

### Database

Queries and data access.

### Validation

Input schemas and boundary validation.

### Configuration

Environment/runtime configuration.

### Testing

Unit/integration/E2E tests.

Do not mix all of these responsibilities into page components.

---

# 35. ENVIRONMENT MANAGEMENT

Create a safe environment-variable strategy.

Provide:

- Development configuration
- Example environment file
- Production configuration documentation

Never commit:

- Production secrets
- Service-role keys
- OAuth client secrets
- Database passwords

Verify `.gitignore`.

---

# 36. GIT / VERSION CONTROL

Treat Git as part of the engineering process.

Ensure:

- Clean repository state
- Meaningful changes
- No generated junk
- No secrets committed
- No unnecessary dependency changes

Use conventional, meaningful commit structure if commits are being created.

Examples of appropriate commit intent:

- project foundation
- authentication foundation
- OAuth integration
- authorization/RLS
- authentication tests
- CI setup
- documentation

Do not create meaningless commits such as:

"update"

"fix stuff"

"changes"

---

# 37. CI/CD

Create a professional CI pipeline appropriate to the repository.

At minimum CI should verify:

1. Dependency installation
2. Typecheck
3. Lint
4. Unit/integration tests
5. Production build

If the repository uses GitHub Actions, configure the appropriate workflow.

CI must fail when:

- TypeScript fails
- Lint fails
- Tests fail
- Build fails

Do not bypass failed checks.

---

# 38. DEPLOYMENT READINESS

Prepare the application for deployment.

Document:

- Required environment variables
- Supabase project configuration
- OAuth provider configuration
- Redirect URLs
- Production domain configuration
- Build command
- Test command
- Deployment process

Do not claim OAuth is production-ready until the provider-side configuration is documented and verified.

---

# 39. DOCUMENTATION

Create professional documentation.

At minimum:

### README

Include:

- Project overview
- Technology stack
- Local setup
- Environment variables
- Development commands
- Testing
- Build
- Deployment

### Architecture documentation

Explain:

- Authentication architecture
- Session architecture
- Role architecture
- Supabase architecture
- Database relationship
- Security boundaries

### Phase 1 documentation

Document:

- What was implemented
- What was intentionally excluded
- Known limitations
- Required manual Supabase configuration
- Required Google configuration
- Required Facebook configuration

### Security documentation

Document:

- Authentication model
- Authorization model
- RLS
- Session handling
- OAuth flow
- Secrets management
- Threat considerations

---

# 40. MANUAL SUPABASE CONFIGURATION

Clearly identify anything that cannot be safely automated from the application repository.

Document required Supabase dashboard configuration such as:

- Google provider
- Facebook provider
- OAuth redirect URLs
- Site URL
- Redirect allowlist
- Email authentication settings
- Password policies
- Email verification configuration
- Any required RLS configuration

Do not pretend these are configured if they require manual dashboard actions.

---

# 41. SECURITY REVIEW

Before declaring Phase 1 complete, perform a security review against common web application risks.

Check:

- Authentication bypass
- Authorization bypass
- Privilege escalation
- IDOR
- Session leakage
- Token leakage
- OAuth misconfiguration
- Open redirects
- XSS
- CSRF considerations
- Injection
- Sensitive information exposure
- Secret leakage
- Improper error handling
- Weak access control
- RLS mistakes

Use OWASP guidance as a reference.

Supabase Auth should remain the authentication authority and PostgreSQL RLS should be part of the authorization boundary.

---

# 42. PERFORMANCE REVIEW

Check:

- Authentication page bundle
- Unnecessary client components
- Excessive dependencies
- Unnecessary JavaScript
- Image loading
- Animation performance
- Server/client boundaries

Prefer server components where appropriate.

Only use client components where interactivity requires them.

Do not turn the entire application into a client-rendered application unnecessarily.

---

# 43. FINAL VALIDATION

Before declaring completion, run:

- Formatting
- Lint
- Typecheck
- Unit tests
- Integration tests
- E2E tests where configured
- Production build

Then manually verify:

### Customer

Signup

→ Authentication

→ Session

→ Customer route

→ "Customer"

### Owner

Login

→ Authentication

→ Role verification

→ Owner route

→ "Owner"

### Unauthorized

Customer

→ Owner route

→ Access denied/redirect

Unauthenticated user

→ Protected route

→ Login

OAuth

→ Provider

→ Callback

→ Session

→ Correct destination

---

# 44. DO NOT IMPLEMENT YET

Do NOT implement:

- Products
- Product CRUD
- Product images
- Categories
- Offers
- Promotions
- Cart
- Checkout
- Orders
- Quotes
- Razorpay
- WhatsApp ordering
- Customer dashboard
- Owner dashboard functionality
- Delivery
- Notifications
- Reviews

Those belong to later phases.

Only establish the foundation required for them.

---

# 45. DEFINITION OF DONE

Phase 1 is complete only when:

- Authentication works.
- Customer signup works.
- Customer login works.
- Customer logout works.
- Google OAuth works after provider configuration.
- Facebook OAuth works after provider configuration.
- Owner authentication works.
- Owner authorization works.
- Customer cannot access owner functionality.
- Protected routes work.
- Supabase sessions work correctly with Next.js SSR.
- Appropriate RLS is implemented.
- No passwords are stored manually.
- No custom JWT authentication layer exists.
- No tokens appear in URLs.
- No secrets are committed.
- Authentication UI is polished and responsive.
- Accessibility has been considered.
- Tests pass.
- Lint passes.
- Typecheck passes.
- Production build passes.
- CI is configured.
- Documentation exists.
- Supabase manual setup is documented.
- The codebase is clean and ready for Phase 2.

---

# 46. FINAL REPORT

When finished, provide a professional implementation report containing:

## Implemented

List exactly what was built.

## Architecture

Explain the final authentication/session/authorization architecture.

## Skills

List the AI skills that were available, which ones were installed, and where they were actually used.

Do not claim a skill was used if it was not.

## Database

Describe the tables, relationships, and RLS policies created.

## Security

Describe the security controls implemented.

## Testing

Report:

- Unit tests
- Integration tests
- E2E tests
- Lint
- Typecheck
- Build

with their actual results.

## Documentation

List documentation created or updated.

## CI/CD

Describe the CI workflow.

## Manual Configuration Required

Clearly list anything the developer still needs to configure in Supabase, Google, Facebook, or the deployment provider.

## Known Limitations

List only real remaining limitations.

## Phase 2 Readiness

Explain whether the authentication foundation is ready for the next phase.

Do not claim "production ready" unless the implementation has actually passed the validation described above.

---

# MOST IMPORTANT RULE

Do not rush.

Do not generate a huge amount of code immediately.

First understand the repository.

Then design the architecture.

Then implement.

Then test.

Then review.

Then secure.

Then document.

Then validate the production build.

The goal is not merely to make the login page work.

The goal is to establish the **professional engineering foundation of the entire bakery commerce platform** so that every future phase can build on it without major rewrites.
