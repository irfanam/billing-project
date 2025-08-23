-- Migration 0012: drop product_code column and related artifacts
-- Migration 0012: drop product_code column and related artifacts

-- This migration will PRESERVE existing top-level `product_code` values by copying them
-- into `meta->>'p_code'` when p_code is not already set. It is idempotent: safe to run
-- multiple times. After copying we drop the top-level column and related artifacts.

BEGIN;

-- 1) Copy existing top-level product_code into meta.p_code where p_code is missing/empty.
--    Trim whitespace and only copy non-empty values. Do not overwrite existing p_code.
UPDATE products
SET meta = jsonb_set(coalesce(meta, '{}'::jsonb), '{p_code}', to_jsonb(trim(both ' ' FROM product_code)::text), true)
WHERE product_code IS NOT NULL
	AND trim(both ' ' FROM product_code) <> ''
	AND (meta->>'p_code' IS NULL OR trim(both ' ' FROM (meta->>'p_code')) = '');

-- 2) Drop unique index on product_code if exists
DROP INDEX IF EXISTS products_product_code_key;

-- 3) Remove product_code column
ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS product_code;

-- 4) Remove product_code entry from product_variable_types (if present)
DELETE FROM product_variable_types WHERE vtype = 'product_code';

-- 5) Remove counters entry for product_code if present
DELETE FROM counters WHERE name = 'product_code';

COMMIT;

-- Note: this migration is destructive for the top-level column (we copy values into meta.p_code first).
