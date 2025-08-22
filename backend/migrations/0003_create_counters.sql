-- Migration: create counters table for atomic code generation
BEGIN;

CREATE TABLE IF NOT EXISTS counters (
  name text PRIMARY KEY,
  value bigint NOT NULL
);

-- initialize counters based on existing rows
INSERT INTO counters (name, value)
SELECT 'customer_code', COALESCE(MAX((SUBSTRING(customer_code FROM 4))::bigint), 0) FROM customers
ON CONFLICT (name) DO NOTHING;

INSERT INTO counters (name, value)
SELECT 'product_code', COALESCE(MAX((SUBSTRING(product_code FROM 4))::bigint), 0) FROM products
ON CONFLICT (name) DO NOTHING;

INSERT INTO counters (name, value)
SELECT 'supplier_code', COALESCE(MAX((SUBSTRING(supplier_code FROM 4))::bigint), 0) FROM suppliers
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Usage: to get next value atomically:
-- UPDATE counters SET value = value + 1 WHERE name = 'customer_code' RETURNING value;

-- Create a function to increment and return the counter atomically via RPC
CREATE OR REPLACE FUNCTION increment_counter(p_name text)
RETURNS TABLE(value bigint) AS $$
BEGIN
  UPDATE counters SET value = value + 1 WHERE name = p_name RETURNING counters.value INTO value;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
