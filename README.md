# Bake n Take

A neighbourhood bakery storefront and owner console built with Next.js 16,
React 19, TypeScript, Tailwind CSS 4, shadcn/ui and Supabase.

Customers sign in, browse the bake list, configure a product, apply an offer,
schedule pickup, place an order and follow it to collection. Owners manage the
catalog, orders, promotions, hero carousel and store profile from a dedicated
console.

**Status:** Phase 8 complete. Orders are accepted with cash on delivery or pay
at pickup; no online payment gateway is integrated yet.

## Features

- **Accounts** — email/password, Google and Facebook OAuth, password reset,
  role-based redirects, per-account URLs and a separate staff entrance.
- **Storefront** — store-branded landing page with hero carousel, offers rail,
  featured and trending bakes, about section, reviews and newsletter signup.
- **Catalog** — categories, search and filters, product galleries, variants,
  flavours, egg options, messages and custom-design uploads, with live price
  previews.
- **Cart and checkout** — server-priced lines, coupon validation, pickup
  scheduling against each product's minimum prep time, and an idempotent
  `create_order` RPC.
- **Orders** — `pending → confirmed → baking → ready_for_pickup → completed`
  (or `cancelled`), order history, detail pages, Realtime notification bell and
  an owner order console.
- **Owner console** — orders, products and categories, offers and coupons,
  hero slides and store settings (branding, hours, socials, about, delivery
  and contact details).
- **Security** — Supabase Auth as the only authority, server-side session
  checks, Postgres RLS and grants, per-request CSP and hardened headers.

## Stack

| Layer      | Technology                                                      |
| ---------- | --------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 19, TypeScript (strict)          |
| UI         | Tailwind CSS 4, shadcn/ui, Lucide, self-hosted display font     |
| Data/Auth  | Supabase (`@supabase/ssr`, `@supabase/supabase-js`), PostgreSQL |
| Validation | Zod                                                             |
| Testing    | Vitest + Testing Library, Playwright                            |
| Quality    | ESLint, Prettier, GitHub Actions                                |

## Local setup

Requirements: Node.js 22+, npm and a Supabase project.

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev                  # http://localhost:3000 → redirects to /login
```

Apply `supabase/migrations/*.sql` in filename order (Supabase CLI or the
dashboard SQL editor), then complete the dashboard steps in
`docs/SUPABASE-SETUP.md`: confirm-email off, redirect URLs, OAuth providers,
password policy, owner bootstrap and the two storage buckets. Without those
steps signup cannot issue a session and OAuth buttons have nowhere to go.

## Environment variables

| Variable                               | Scope  | Purpose                                           |
| -------------------------------------- | ------ | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public | Supabase project URL                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Browser-safe Supabase key                         |
| `NEXT_PUBLIC_SITE_URL`                 | Public | Canonical origin for OAuth and email redirects    |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server | Owner bootstrap and reset scripts only            |
| `OWNER_EMAIL`                          | Server | Account promoted by `npm run owner:promote`       |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`       | Server | Fresh-start admin used by `npm run project:reset` |
| `SUPABASE_ACCESS_TOKEN`                | Server | Optional Management API access for migrations     |

Only the two `NEXT_PUBLIC_*` Supabase values are exposed to the browser. Never
commit `.env.local`, the service-role key or OAuth client secrets.

## Database

The migrations in `supabase/migrations/` build the schema incrementally:

| Phase | Migration area                                                   |
| ----- | ---------------------------------------------------------------- |
| 1     | Auth profiles, roles, RLS and escalation guard                   |
| 2     | Store settings, branding and the public `store-assets` bucket    |
| 3     | Categories, products, images, variants, flavours, custom designs |
| 4     | Carts, orders, payments, events, notifications, Realtime         |
| 5     | Offers, coupons, redemptions and the promotion engine            |
| 5.1   | Dynamic hero carousel and store highlights                       |
| 6     | Newsletter signups                                               |
| 7     | Owner-editable About section                                     |
| 8     | Per-product prep times and pickup scheduling                     |

`customer-designs` is a private storage bucket for customer artwork; owners
read it through short-lived signed URLs. Order creation and status transitions
run inside definer RPCs, so totals and state changes cannot be forged from the
browser.

## Routes

| Route                                                       | Who                                         |
| ----------------------------------------------------------- | ------------------------------------------- |
| `/`                                                         | redirects to the caller's area or `/login`  |
| `/login`, `/signup`, `/forgot-password`, `/update-password` | public auth                                 |
| `/owner/login`                                              | staff entrance (OWNER enforced server-side) |
| `/webstore/[uid]`                                           | signed-in customer storefront               |
| `/webstore/[uid]/shop`, `/shop/[slug]`                      | bake list and product detail                |
| `/webstore/[uid]/cart`, `/checkout`                         | cart and checkout                           |
| `/webstore/[uid]/orders`, `/orders/[id]`                    | order history and detail                    |
| `/owner/[uid]`                                              | owner dashboard                             |
| `/owner/orders`, `/owner/orders/[id]`                       | order management                            |
| `/owner/products`, `/new`, `/[id]`                          | product and category management             |
| `/owner/offers`, `/new`, `/[id]`                            | offers and coupons                          |
| `/owner/hero`, `/new`, `/[id]`                              | hero carousel management                    |
| `/owner/settings`                                           | store settings                              |
| `/customer`, `/owner`                                       | backwards-compatible redirects              |
| `/auth/callback`                                            | Supabase PKCE/OTP exchange                  |

Every `/webstore/[uid]` and `/owner/[uid]` request verifies the URL id against
the server session, so a URL cannot be used to reach another account.

## Commands

```bash
npm run dev           # development server
npm run test          # unit + integration tests (hermetic, mocked Supabase)
npm run test:e2e      # Playwright (public suite needs no real accounts)
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run format:check  # Prettier
npm run build         # production build
npm run verify        # format + lint + typecheck + test + build
npm run owner:promote # one-time owner bootstrap (needs service-role key)
npm run project:reset # wipe and recreate a fresh project (destructive)
node scripts/seed-hero-images.mjs # seed predefined hero images
```

## Testing and CI

- Unit and integration tests live beside the code and use a mocked Supabase
  client, so they never touch a database.
- Playwright covers routing, the public auth UI, security headers, catalog,
  orders and store settings on mobile and desktop Chromium.
- Authenticated E2E suites are skipped unless `E2E_CUSTOMER_*` and
  `E2E_OWNER_*` variables are provided.
- `.github/workflows/ci.yml` runs the quality gate on every push and pull
  request to `main`, then the public E2E suite.

## Architecture

Authentication is delegated entirely to Supabase Auth with cookie sessions
managed by `@supabase/ssr` and verified per request with `auth.getUser()`.
Application identity lives in `public.profiles`; a database trigger assigns the
default `CUSTOMER` role, and `OWNER` is granted only by operator tooling.
Authorization is enforced twice: in the server data-access layer
(`lib/auth/session.ts`) and in Postgres through RLS, column grants and an
escalation-guard trigger.

UI, auth, validation, domain logic and data access stay in separate modules:

```text
app/          routes and server components
components/   UI by feature (auth, catalog, orders, offers, hero, store, admin)
lib/          auth, catalog, orders, promotions, hero, store, supabase
supabase/     SQL migrations (schema, RLS, RPCs, storage policies)
tests/        Playwright suites and Supabase test doubles
docs/         architecture, security, testing and phase specifications
```

## Documentation

- `docs/SUPABASE-SETUP.md` — required dashboard configuration and migration checks.
- `docs/SECURITY.md` — auth model, authorization boundary, RLS and headers.
- `docs/TESTING.md` — suites, coverage map and test-account provisioning.
- `docs/STORE-SETTINGS.md` — store settings architecture and owner guide.
- `docs/PRODUCT-CATALOG.md` — catalog architecture and owner guide.
- `docs/ORDERS.md` — cart, checkout, order lifecycle, notifications and RPCs.
- `docs/OFFERS.md` — promotion types, coupons, eligibility and discount math.
- `docs/HERO.md` — hero selection, merchandising and fallback behavior.
- `docs/phases/` — the authoritative specification for each delivery phase.

## Deployment

The app deploys to any Next.js 16 host (Vercel is the simplest). Set the
`NEXT_PUBLIC_*` variables and `NEXT_PUBLIC_SITE_URL` for the production origin,
apply the migrations to the production Supabase project, and add the production
`/auth/callback` URL to Supabase's redirect allowlist. Configure custom SMTP
before relying on password-reset email.
