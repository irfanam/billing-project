-- Migration: add archived boolean to products for soft-delete support
-- idempotent: checks if column exists before altering
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='products' AND column_name='archived'
    ) THEN
        ALTER TABLE products ADD COLUMN archived boolean DEFAULT false;
    END IF;
END$$;
