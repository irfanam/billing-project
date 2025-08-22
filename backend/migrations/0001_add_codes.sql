-- Migration: add customer_code and product_code columns and unique indexes
-- Run this on the Supabase/Postgres database (psql or via SQL editor in Supabase)

BEGIN;

ALTER TABLE IF EXISTS customers
  ADD COLUMN IF NOT EXISTS customer_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_code_key
  ON customers (customer_code);

ALTER TABLE IF EXISTS products
  ADD COLUMN IF NOT EXISTS product_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_product_code_key
  ON products (product_code);

COMMIT;

-- Notes:
-- 1) This migration makes the new code columns nullable initially; repository will populate
--    them for new rows. If you prefer NOT NULL, run an UPDATE to backfill existing rows and
--    then ALTER TABLE ... SET NOT NULL.
-- 2) If your dataset already contains duplicate values in the target columns, the CREATE
--    UNIQUE INDEX will fail. In that case, inspect and dedupe before applying.
