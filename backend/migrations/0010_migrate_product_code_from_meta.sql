-- Migration 0010: migrate product_code from meta->>'product_code' into top-level product_code
-- Copies the user-selected product_code stored in `meta` into the top-level `product_code`
-- Only updates rows where the top-level `product_code` is NULL, empty, or looks like a generated UID
-- The migration is idempotent: it will not overwrite an existing non-UID product_code or copy empty values.

BEGIN;

DO $$
BEGIN
  -- guard: only run when the expected columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name IN ('meta','product_code')
  ) THEN

    UPDATE products
    SET product_code = trim(BOTH ' ' FROM (meta->>'product_code'))
    WHERE (
        product_code IS NULL
        OR product_code = ''
        OR product_code ~* '^UID'  -- generated UID values like UID000012
        OR product_code ~* '^uid'
      )
      AND meta IS NOT NULL
      AND (meta->>'product_code') IS NOT NULL
      AND trim(BOTH ' ' FROM (meta->>'product_code')) <> ''
      -- avoid touching rows where product_code already equals the meta value
      AND product_code IS DISTINCT FROM trim(BOTH ' ' FROM (meta->>'product_code'));

  END IF;
END
$$;

COMMIT;

-- Verification examples (run manually):
-- SELECT id, product_code, meta->>'product_code' AS meta_code FROM products
-- WHERE product_code IS NULL OR product_code = '' OR product_code ~* '^UID';
