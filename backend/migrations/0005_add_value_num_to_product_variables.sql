-- Migration: add numeric column for product_variables to store numeric values (GST)
BEGIN;

ALTER TABLE IF EXISTS product_variables
  ADD COLUMN IF NOT EXISTS value_num numeric;

CREATE INDEX IF NOT EXISTS idx_product_variables_vtype_value_num ON product_variables(vtype, value_num);

COMMIT;

-- After applying, GST entries can be inserted with value_num populated for numeric queries.
