-- =============================================================================
-- Bake n Take — Phase 2: drop the unused store short name
-- =============================================================================
-- The owner console and storefront use the full store name everywhere plus the
-- tagline as the slogan; the short name has no consumer. Removing the column
-- keeps the singleton model free of dead fields.
--
-- Idempotent and safe to re-run.
-- =============================================================================

alter table public.store_settings drop column if exists short_name;
