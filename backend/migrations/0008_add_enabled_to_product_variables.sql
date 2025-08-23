-- Idempotent migration: add `enabled` boolean column to product_variables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='product_variables' AND column_name='enabled'
    ) THEN
        ALTER TABLE product_variables ADD COLUMN enabled boolean DEFAULT true;
    END IF;
END$$;
