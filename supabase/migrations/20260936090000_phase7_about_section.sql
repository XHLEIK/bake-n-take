-- =============================================================================
-- Bake n Take — Phase 7: owner-editable About Us section.
--
-- Adds one nullable `about` jsonb column to the singleton store_settings
-- row, following the established `socials`/`hours` precedent: schemaless in
-- the database so copy and banner choices can grow without schema changes,
-- with the shape pinned in lib/store/types.ts and enforced by zod
-- server-side. Null (or malformed) content falls back to compiled defaults
-- on read, so existing stores render a complete section with zero setup.
--
-- Table-level RLS policies and grants already cover the whole row, so no
-- policy changes are needed for the new column.
--
-- The script is idempotent so it can be re-run safely from the SQL editor.
-- =============================================================================

alter table public.store_settings
  add column if not exists about jsonb;

comment on column public.store_settings.about is
  'Owner-editable About Us section (enabled, copy, CTA, banner key and custom banner path). Null falls back to compiled defaults.';
