-- Migration 0011: copy meta->>'product_code' into meta->'p_code' and remove old key
-- Idempotent: only updates rows where meta.product_code exists and meta.p_code is missing/empty.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'meta'
  ) THEN

    -- Copy into p_code when p_code not set and product_code present
    UPDATE products
    SET meta = jsonb_set(meta, '{p_code}', to_jsonb(trim(BOTH ' ' FROM (meta->>'product_code'))::text), true)
    WHERE meta IS NOT NULL
      AND (meta->>'product_code') IS NOT NULL
      AND trim(BOTH ' ' FROM (meta->>'product_code')) <> ''
      AND (meta->>'p_code' IS NULL OR trim(BOTH ' ' FROM (meta->>'p_code')) = '');

    -- Remove old product_code key for rows we migrated above
    UPDATE products
    SET meta = meta - 'product_code'
    WHERE meta IS NOT NULL
      AND (meta->>'p_code') IS NOT NULL
      AND (meta->>'product_code') IS NOT NULL;

  END IF;
END
$$;

COMMIT;

-- Manual checks:
-- SELECT id, meta->>'p_code' AS p_code, meta->>'product_code' AS old_code FROM products WHERE meta IS NOT NULL;
