-- Migration 0006: add meta jsonb column to products
-- Adds a nullable jsonb column `meta` for structured product metadata (variant, company, etc.)

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS meta jsonb;

-- Optionally create an index on meta->>'variant' if queries will filter by variant
-- CREATE INDEX IF NOT EXISTS idx_products_meta_variant ON products ((meta->>'variant'));
