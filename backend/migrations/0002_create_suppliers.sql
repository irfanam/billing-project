-- Migration: create suppliers table and supplier_code index
BEGIN;

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  address text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  supplier_code text
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_supplier_code_key
  ON suppliers (supplier_code);

COMMIT;

-- Note: gen_random_uuid() requires the pgcrypto extension on some Postgres setups.
-- If not available, the default will need to be adjusted or the client can provide UUIDs.
