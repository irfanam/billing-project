-- DDL for stock ledger and reservations

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id),
  change integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  unit_cost numeric(12,2),
  created_by text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id),
  qty integer NOT NULL,
  invoice_id uuid,
  status text NOT NULL DEFAULT 'active', -- active / consumed / released / expired
  expires_at timestamptz,
  created_by text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_id ON public.stock_reservations (product_id);
*** End Patch
