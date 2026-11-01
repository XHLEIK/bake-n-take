# Supabase setup (Phase 1 — authentication foundation)

Project reference for local development: `qpzalislxkjviknhwlgv`
(`NEXT_PUBLIC_SUPABASE_URL=https://qpzalislxkjviknhwlgv.supabase.co`).

The database side (tables, trigger, RLS, privileges) is applied from
`supabase/migrations/*.sql` — run them in the Supabase Dashboard SQL editor or
with the Supabase CLI. Everything below is dashboard configuration that cannot
live in the repository.

## 1. Disable signup email confirmation (required)

Phase 1 signs customers straight in after signup — there is no "check your
inbox" step anywhere in the app.

1. Open the Supabase Dashboard → your project → **Authentication** →
   **Providers** → **Email**.
2. Switch **Confirm email** to **OFF**.
3. Save.

Verification: sign up at `http://localhost:3000/signup` with a fresh address.
You must land directly on `/webstore/<uid>`. If you instead see "This account
cannot sign in yet", the toggle is still ON.

Safety net: if the toggle is left ON, signup self-heals — the server confirms
the just-registered address with the service role and signs straight in
(`confirmAndSignIn` in `lib/actions/auth.ts`). This needs
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server-only, never `NEXT_PUBLIC_`,
never committed) and a dev-server restart after adding it. Keep the dashboard
toggle OFF anyway: it is the clean primary switch, and login for older
unconfirmed accounts keeps working without surprises.

> Why this is safe here: passwords are still stored and checked by Supabase
> Auth (bcrypt, rate-limited). Confirmation only proves mailbox ownership; the
> bakery collects so little at signup that instant access is the product
> decision. Password _reset_ still goes through email (see below).

## 2. Redirect URLs and site URL (required)

Authentication → **URL Configuration**:

- **Site URL**: `http://localhost:3000` (production: your canonical domain).
- **Redirect URLs** (allowlist — the OAuth/email callback must match one):
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/callback?next=/update-password`
  - production equivalents, e.g. `https://bakentake.example.com/auth/callback`

The per-account pages (`/webstore/[uid]`, `/owner/[uid]`) need no extra
entries: the OAuth `redirectTo` always points at `/auth/callback`, and the
final destination is resolved server-side after the session exists. Never add
wildcard hosts you do not own.

## 3. Email provider for password reset (required)

Phase 1 keeps the forgot-password flow, which sends a reset email:

1. Authentication → **Providers** → **Email** → confirm it is **enabled**.
2. For local development the built-in mailer is enough (check Auth → Users or
   use the Inbucket link shown in the email logs).
3. For production, configure a custom SMTP sender under Project Settings →
   **Auth** → **SMTP Settings** so reset mail is deliverable.

## 4. Google OAuth (after provider configuration)

1. Google Cloud Console → create OAuth client (Web application).
   Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase Dashboard → Authentication → **Providers** → **Google** → enable,
   paste Client ID + Client Secret.
3. Test: `/login` → Continue with Google → consent → back to `/auth/callback`
   → lands on `/webstore/<uid>`.

## 5. Facebook OAuth (after provider configuration)

1. Meta for Developers → create app → add **Facebook Login**, set Valid OAuth
   Redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase Dashboard → Authentication → **Providers** → **Facebook** →
   enable with App ID + App Secret.
3. Same test as Google.

## 6. Password policy (recommended)

Authentication → **Policies** (or Project Settings → Auth):

- Minimum length 8 (the app validates this client- and server-side too).
- Enable leaked-password protection if available on your plan.

Rate limiting for sign-in/signup comes from Supabase Auth out of the box; the
app additionally curates `rate_limited` errors instead of leaking internals.
No custom rate limiter is built in Phase 1.

## 7. Owner bootstrap (one time)

The first owner is created by operator tooling, never through the signup UI
(signup always mints CUSTOMER via the database trigger):

```bash
cp .env.example .env.local   # fill SUPABASE_SERVICE_ROLE_KEY + OWNER_EMAIL
npm run owner:promote        # scripts/bootstrap-owner.mjs
```

Then sign in at `http://localhost:3000/owner/login` and confirm you land on
`/owner/<uid>`. Keep the service-role key out of git and out of the browser.

## 8. Post-setup checks (SQL editor)

```sql
-- expect true
select relrowsecurity from pg_class where oid = 'public.profiles'::regclass;
-- expect the two select/update policies, least-privilege grants
select policyname, cmd, roles::text from pg_policies
 where schemaname = 'public' and tablename = 'profiles';
```

## 9. Phase 2 — store settings (already applied to this project)

- Migration `supabase/migrations/20260925090000_phase2_store_settings.sql`
  creates `public.store_settings` (singleton + seed), its RLS/policies,
  the public `store-assets` bucket and its storage policies. It was applied
  via the Management API; re-running it from the SQL editor is safe
  (idempotent).
- Verify: `select store_name from public.store_settings where id = 1;`
  should return one row, and `select id, public from storage.buckets where
id = 'store-assets';` should return the public bucket.
- Management-API access (migrations, auth config) needs a Personal Access
  Token (`SUPABASE_ACCESS_TOKEN` in `.env.local`, never committed). The
  `opencode-supabase` plugin's own OAuth token is narrowly scoped and cannot
  run SQL or change auth config.

## 10. Phase 3 — product catalog (already applied to this project)

- Migration `supabase/migrations/20260927090000_phase3_product_catalog.sql`
  creates categories, products, images, variants, flavours, all indexes,
  RLS/policies/grants, and the private `customer-designs` bucket with its
  policies. Applied via the Management API; idempotent.
- Migration `supabase/migrations/20260928090000_phase3_categories_as_types.sql`
  removes the product-type system, slims categories to name-only, and makes
  the product category nullable with ON DELETE SET NULL. Applied via the
  Management API; idempotent.
- Verify: `select count(*) from public.products;` runs, and
  `select id, public from storage.buckets where id = 'customer-designs';`
  → one private row.
