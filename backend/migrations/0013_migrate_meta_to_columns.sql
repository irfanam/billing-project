-- Migration 0013: migrate product.meta JSONB into top-level text columns and drop meta
-- Idempotent: safe to run multiple times.

BEGIN;

-- 1) Add new columns if they don't exist. Use text for strings and numeric for selling_price.
ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS company text,
    ADD COLUMN IF NOT EXISTS variant text,
    ADD COLUMN IF NOT EXISTS type text,
    ADD COLUMN IF NOT EXISTS selling_price numeric,
    ADD COLUMN IF NOT EXISTS p_code text;

-- 2) Backfill from meta JSONB into columns when columns are null/empty.
-- Trim whitespace and only copy non-empty values.
UPDATE products
SET company = COALESCE(NULLIF(trim(both ' ' FROM company), ''), trim(both ' ' FROM (meta->>'company')))
WHERE (company IS NULL OR trim(both ' ' FROM company) = '')
  AND meta IS NOT NULL
  AND (meta->>'company') IS NOT NULL
  AND trim(both ' ' FROM (meta->>'company')) <> '';

UPDATE products
SET variant = COALESCE(NULLIF(trim(both ' ' FROM variant), ''), trim(both ' ' FROM (meta->>'variant')))
WHERE (variant IS NULL OR trim(both ' ' FROM variant) = '')
  AND meta IS NOT NULL
  AND (meta->>'variant') IS NOT NULL
  AND trim(both ' ' FROM (meta->>'variant')) <> '';

UPDATE products
SET type = COALESCE(NULLIF(trim(both ' ' FROM type), ''), trim(both ' ' FROM (meta->>'type')))
WHERE (type IS NULL OR trim(both ' ' FROM type) = '')
  AND meta IS NOT NULL
  AND (meta->>'type') IS NOT NULL
  AND trim(both ' ' FROM (meta->>'type')) <> '';

-- selling_price copy: attempt numeric conversion; ignore non-numeric values
UPDATE products
SET selling_price = COALESCE(selling_price, (meta->>'selling_price')::numeric)
WHERE (selling_price IS NULL)
  AND meta IS NOT NULL
  AND (meta->>'selling_price') IS NOT NULL
  AND trim(both ' ' FROM (meta->>'selling_price')) <> ''
  AND (meta->>'selling_price') ~ '^[0-9]+(\.[0-9]+)?$';

UPDATE products
SET p_code = COALESCE(NULLIF(trim(both ' ' FROM p_code), ''), trim(both ' ' FROM (meta->>'p_code')),
                     trim(both ' ' FROM (meta->>'product_code')))
WHERE (p_code IS NULL OR trim(both ' ' FROM p_code) = '')
  AND meta IS NOT NULL
  AND ((meta->>'p_code') IS NOT NULL OR (meta->>'product_code') IS NOT NULL)
  AND (COALESCE(trim(both ' ' FROM (meta->>'p_code')), trim(both ' ' FROM (meta->>'product_code')))) <> '';

-- 3) Optionally remove meta column if present
ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS meta;

COMMIT;

-- Note: this migration intentionally preserves non-empty top-level values and only copies
-- when target columns are empty. It will drop `meta` after copying.
