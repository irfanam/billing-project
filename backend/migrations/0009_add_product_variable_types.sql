-- idempotent migration: create a table to store per-variable-type enabled/disabled flags
CREATE TABLE IF NOT EXISTS product_variable_types (
  vtype text PRIMARY KEY,
  enabled boolean DEFAULT true
);

-- seed common variable types so the management UI can toggle them even before any entries exist
INSERT INTO product_variable_types (vtype, enabled) VALUES ('company', true) ON CONFLICT (vtype) DO NOTHING;
INSERT INTO product_variable_types (vtype, enabled) VALUES ('variant', true) ON CONFLICT (vtype) DO NOTHING;
INSERT INTO product_variable_types (vtype, enabled) VALUES ('gst', true) ON CONFLICT (vtype) DO NOTHING;
INSERT INTO product_variable_types (vtype, enabled) VALUES ('type', true) ON CONFLICT (vtype) DO NOTHING;
INSERT INTO product_variable_types (vtype, enabled) VALUES ('product_code', true) ON CONFLICT (vtype) DO NOTHING;
