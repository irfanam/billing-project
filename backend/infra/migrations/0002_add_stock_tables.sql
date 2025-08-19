-- Migration: Add stock_movements and stock_reservations tables
-- Run this against your Postgres/Supabase DB to add stock primitives used by the app.

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
