# Security model (Phase 1)

## Authentication

- **Authority**: Supabase Auth only. No custom passwords table, no custom
  hashing, no self-issued JWTs, no tokens in `localStorage`, no tokens in URLs.
- **Session transport**: HttpOnly cookies managed by `@supabase/ssr`
  (`lib/supabase/{server,client,proxy}.ts`), refreshed on every request by the
  Next.js 16 `proxy.ts`. Server code verifies with `auth.getUser()` (JWT
  validated against Supabase); the cookie payload is never trusted directly.
- **Flows**: email/password, Google OAuth, Facebook OAuth (both via Supabase
  PKCE, `code` exchanged server-side in `/auth/callback`), password
  reset/recovery via email link. Signup email confirmation is intentionally
  disabled — see `docs/SUPABASE-SETUP.md`.
- **Logout**: `signOutAction` revokes server-side, falls back to local scope
  so a user is never stuck signed in.

## Authorization

- **Roles**: `CUSTOMER` (default, assigned by the `handle_new_user` database
  trigger — user metadata can never influence it) and `OWNER` (assigned only
  by operator tooling with the service-role key).
- **Boundary**: the server-side Data Access Layer (`lib/auth/session.ts`:
  `requireUser`, `requireOwner`, `requireSession`) plus Postgres RLS. Client
  components, hidden buttons, `localStorage`, and URL parameters are never the
  security boundary.
- **Per-account URLs**: `/webstore/[uid]` and `/owner/[uid]` carry the
  caller's id as a navigation hint. Every page verifies `uid ===
session.user.id` server-side (`redirectIfUidMismatch`) and bounces mismatches
  to the caller's own URL with an identical response, so URLs cannot be used
  to probe other accounts or bypass role checks. This is a documented,
  deliberate deviation from the clean-routes preference in the Phase 1 spec —
  a future phase should replace the raw id with an opaque public identifier
  (see "Known limitations" in the final report).

## Database (RLS)

Table `public.profiles` (`id` = `auth.users.id`, enums `user_role`,
`account_status`), RLS enabled, default deny (`anon` has no policy):

- `profiles_select_own_or_owner` — authenticated users read their own row;
  active owners read all rows.
- `profiles_update_own` — active users update only their own row.
- No INSERT/DELETE policies — rows are created by the auth trigger and removed
  by `ON DELETE CASCADE`.
- Column privileges: customers read profile columns but can only write
  `full_name`/`phone`. A `prevent_profile_privilege_escalation` trigger
  rejects `role`/`status` writes from `anon`/`authenticated` even if a policy
  or grant is misconfigured later.

## Transport and headers

- `proxy.ts` sets a per-request nonce CSP (`script-src` nonce +
  `strict-dynamic`; `upgrade-insecure-requests` in production), `frame-ancestors
'none'`, `form-action 'self'`, plus `X-Content-Type-Options`,
  `Referrer-Policy`, HSTS in production, and a restrictive permissions policy.
- All post-auth redirects go through `safeNextPath`/`loginPathFor`/
  `destinationForRole`: same-origin paths only, no protocol-relative or
  backslash tricks, `next` honoured only inside the caller's own area.
- Supabase and application errors are translated to curated codes
  (`lib/auth/errors.ts`, `lib/auth/notices.ts`); raw messages, SQL, and
  endpoint details never reach the UI or URLs, and untrusted query text is
  never echoed.

## Secrets

- Browser-safe: only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Everything else server-side.
- Never committed: service-role key, OAuth client secrets, database passwords
  (`.env.example` documents the shape; `.gitignore` covers `.env*.local`).
- Owner bootstrap credentials travel via environment variables into
  `scripts/bootstrap-owner.mjs`, never through frontend code.

## Threat considerations (OWASP-oriented)

| Risk                        | Control                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| Auth bypass                 | `getUser()` verification per request + proxy optimistic redirect               |
| Privilege escalation / IDOR | DB role reads, RLS, column grants, escalation trigger, uid-match guard         |
| Token/session leakage       | HttpOnly cookies, no tokens in URLs/storage, CSP, `form-action 'self'`         |
| Open redirect               | `safeNextPath` allow-shape + area check on every `next`                        |
| XSS                         | React escaping, nonce CSP, no untrusted echo, `dangerouslySetInnerHTML` unused |
| Enumeration                 | Identical signup/reset responses; curated error codes                          |
| Abuse                       | Supabase Auth rate limits + `rate_limited` UX; no Phase-1 custom limiter       |
| Secret leakage              | Env discipline, `.gitignore`, CI builds with placeholder values                |
