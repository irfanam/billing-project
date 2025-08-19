-- Infra SQL to create products/customers/invoices tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL,
  tax_percent numeric(5,2) DEFAULT 0.00,
  stock_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gstin text,
  state text,
  address text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  subtotal numeric(12,2) NOT NULL,
  cgst_amount numeric(12,2) DEFAULT 0,
  sgst_amount numeric(12,2) DEFAULT 0,
  igst_amount numeric(12,2) DEFAULT 0,
  total_tax numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'INR',
  created_at timestamptz DEFAULT now(),
  issued_by text
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text,
  qty integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  line_total numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices (created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices (customer_id);

-- Stock movements ledger: records stock changes (positive for inbound, negative for outbound)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id),
  change integer NOT NULL,
  reason text,
  reference_type text,
  reference_id uuid,
  unit_cost numeric(12,2),
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Reservations: temporary holds on stock until consumed or released
CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id),
  qty integer NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id),
  status text DEFAULT 'active', -- active|consumed|released
  expires_at timestamptz,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_id ON public.stock_reservations (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements (product_id);
