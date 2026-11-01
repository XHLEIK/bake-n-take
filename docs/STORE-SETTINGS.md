# Store Settings (Phase 2)

Single source of truth for the bakery's public identity:

**Owner console → `store_settings` (PostgreSQL) + `store-assets` (Storage) → `lib/store` data layer → header / footer / login / signup / storefront / metadata.**

Change the name once in Store Settings and the whole application knows —
no code touch, no redeploy.

## Architecture

### Database — `public.store_settings` (singleton, id = 1)

One row, enforced by `PRIMARY KEY + CHECK (id = 1)`. Columns: identity
(`store_name`, `tagline`, `description`, `logo_path`, `favicon_path`), contact (phones, email, WhatsApp), structured address
(lines, locality, city, state, PIN, country, maps URL, lat/lng), `socials`
jsonb (`{instagram, facebook, whatsapp, extra[]}`), `hours` jsonb
(`{monday: {open, opens_at, closes_at}, …}`), pickup (instructions, location,
notes, ETA), status (`is_open`, `accepting_orders`, `status_message`),
regional (`currency`, `currency_symbol`, `timezone`), `created_at` /
`updated_at` (trigger-maintained).

Every column is intentionally public. **Never add secrets or internal config
to this table** — RLS exposes the whole row to anonymous visitors.

### Public vs private

There is no private column today by design. If a future phase needs internal
settings, add a separate table (e.g. `store_config_private`) with owner-only
policies — do not mix secrets into `store_settings`.

### RLS & privileges

- `SELECT` to `anon, authenticated` using `true` (public storefront data).
- `UPDATE` to `authenticated` using/with-check `public.is_owner()` (ACTIVE
  OWNER only; the same rule as profiles).
- No INSERT/DELETE policies (seeded singleton; operators only).
- Column grants mirror the policies; service role bypasses for tooling.

### Storage — `store-assets` bucket (public)

Logo bytes live in Storage, never in Postgres; the table keeps the path.
Policies: public `SELECT`; owner-only INSERT/UPDATE/DELETE via `is_owner()`.
Uploads are validated server-side (PNG/JPEG/WebP magic bytes, ≤ 2 MB,
dimension ceiling for PNG/JPEG; SVG rejected). Public URLs are built with
`storeAssetUrl()` and rendered through `next/image` (remote pattern locked to
`…/store-assets/**`).

### Data layer — `lib/store/`

| Module          | Role                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`      | `StoreSettings` model + fail-closed row mapper (bad rows → neutral UI, never a crash)                                                       |
| `validation.ts` | zod schemas for the whole form + image-byte validator (shared client/server)                                                                |
| `repository.ts` | `getStoreSettings()` — `unstable_cache` (tag `store-settings`, 1 h backstop) + React `cache()` dedupe; `storeAssetUrl()`, `formatAddress()` |
| `actions.ts`    | `updateStoreSettingsAction` — `requireOwner` → validate → stage uploads → update row → retire old files → `updateTag` + layout revalidate   |
| `format.ts`     | `formatMoney()`, `formatDayHours()` for future commerce phases                                                                              |

Components never query Supabase for settings directly. Failures resolve to
`null`; callers render neutral states (icon tile, no name, hidden sections)
and auth keeps working.

### Caching & revalidation

Global, rarely-changed data: cached across requests, invalidated immediately
on save (`updateTag("store-settings")` + `revalidatePath("/", "layout")`).
No redeploy needed for any settings change.

## Owner guide

Open **Store Settings** from the owner area (`/owner/settings`). Sections:
Identity, Brand images, Contact, Address, Business hours, Social media,
Pickup, Status, Regional. Edit freely — nothing persists until **Save
settings**. Leaving with edits warns you; **Reset changes** discards them.

- Images stage locally (preview instantly) and upload on save. Removal also
  applies on save. Only PNG/JPEG/WebP ≤ 2 MB.
- Hours: toggle each day; closed days hide on the storefront.
- Socials: only filled platforms render icons. Use full `https://` URLs.
- Status off → banner on the storefront (`is_open` = closed,
  `accepting_orders` = ordering paused) with your message.
- Regional currency/symbol/timezone feed formatting everywhere; pick a real
  IANA timezone.

## Developer guide

- Read: `const settings = await getStoreSettings()` in a Server Component
  (never in client components — pass values down as props).
- Write: owner-only via `updateStoreSettingsAction`. Never update the table
  from client code.
- Add a field: migration column + `types.ts` + `validation.ts` + form section
  - consumers. No other wiring needed (cache tag covers invalidation).
- Logos: `storeAssetUrl(settings.logoPath)` + `next/image`. Never hardcode a
  brand string as a fallback — render neutrally when settings are null.
- Money: `formatMoney(amount, settings)` — never hardcode `₹`/INR at call sites.

## Applied migration

`supabase/migrations/20260925090000_phase2_store_settings.sql` — table,
trigger, seed, RLS, grants, bucket, storage policies. Applied to the live
project via the Management API; re-runnable from the SQL editor.
