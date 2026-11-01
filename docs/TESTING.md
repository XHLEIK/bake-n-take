# Testing (Phase 1)

## Stack

- **Unit/integration**: Vitest (`npm run test`, watch with `npm run test:watch`).
  Supabase is fully mocked (`tests/helpers/supabase-mock.ts`), so these runs
  are hermetic — they never touch any database.
- **E2E**: Playwright (`npm run test:e2e`, config in `playwright.config.ts`,
  mobile + desktop Chromium projects).
- **Full gate**: `npm run verify` = format:check → lint → typecheck → test →
  build. CI (`.github/workflows/ci.yml`) runs the same gate plus the public
  E2E suite on every push/PR to `main`.

## What runs where

| Suite                                                                | Needs                                                             | Command                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------- |
| Unit/integration (`lib/**`, `components/**`, `app/**/route.test.ts`) | nothing                                                           | `npm run test`            |
| Public E2E (`routing`, `auth-ui`, `security-headers`)                | production build on :3100, placeholder Supabase env (CI provides) | `npm run test:e2e`        |
| Authenticated E2E (`authenticated.spec.ts`)                          | real test project + `E2E_CUSTOMER_*` / `E2E_OWNER_*`              | skipped unless env is set |

## Coverage map (spec §30)

- Customer: signup, login, logout, invalid login, password validation, session
  persistence (reload), protected webstore route, unauthorized owner route.
- OAuth: Google/Facebook initiation (PKCE URL, account chooser), callback
  handling, cancellation/error mapping. Provider round-trips need manual
  verification after dashboard setup (see `docs/SUPABASE-SETUP.md`).
- Owner: owner login, OWNER authorization, customer-rejected-at-entrance,
  unauthenticated-to-staff-entrance, uid-mismatch bounce.
- Security: role-manipulation attempt (customer at owner URL), protected
  routes without session (`next` hints preserved), invalid/expired sessions,
  RLS policies (applied from `supabase/migrations`, verified by the SQL in
  `docs/SUPABASE-SETUP.md` §8).
- UI: form validation, loading/disabled states, curated error states,
  keyboard order + focus ring, mobile layout (no overflow, ≥40px targets),
  theme toggle persistence, reduced-motion respect.
- Promotions (Phase 5): coupon normalization, IST scheduling, effective
  status/transitions, type mappers, owner-action guards, banner/coupon/row
  components. Engine math and the first-order abuse scenario were verified
  live against the database with throwaway fixtures (fully removed); the
  suite itself stays hermetic (see `docs/OFFERS.md`).
- Hero highlights (Phase 5.1): tier ordering, slide caps, product dedupe,
  fallback (empty + imageless), scheduled/expired/paused exclusion,
  deleted-source and invalid-destination exclusion, validation schemas,
  owner-action guards, carousel and form rendering (see `docs/HERO.md`).

## Provisioning authenticated E2E accounts

Never run these against production. Use a dedicated Supabase project (or
clearly-marked test users in a dev project) with email confirmation OFF:

```bash
E2E_CUSTOMER_EMAIL=customer@example.com E2E_CUSTOMER_PASSWORD=… \
E2E_OWNER_EMAIL=owner@example.com E2E_OWNER_PASSWORD=… \
npm run test:e2e -- authenticated
```

Promote the owner test user with `npm run owner:promote` against that project.

## Known E2E caveats

- Playwright failure artifacts land in `test-results/` (git-ignored). They are
  diagnostic noise, not application code.
- If the public suite fails locally with browser errors, run
  `npx playwright install chromium` once, then re-run.
