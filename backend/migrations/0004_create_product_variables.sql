-- Migration: create product_variables for persisting product-level variables
BEGIN;

CREATE TABLE IF NOT EXISTS product_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vtype text NOT NULL,
  value text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variables_vtype ON product_variables(vtype);

COMMIT;

-- Usage examples:
-- INSERT INTO product_variables (vtype, value) VALUES ('company', 'ACME Supplies');
-- SELECT * FROM product_variables WHERE vtype='company' ORDER BY sort_order, created_at;
