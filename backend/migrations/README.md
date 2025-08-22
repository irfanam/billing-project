Migration: Add persistent customer_code and product_code

Files:
- 0001_add_codes.sql: ALTER TABLE to add customer_code and product_code and create unique indexes.
- ../scripts/backfill_codes.py: Python helper to backfill existing rows after applying the migration.

Steps to apply:

1) Apply the SQL migration to your Postgres/Supabase database. You can run it via psql or
   the SQL editor inside the Supabase dashboard:

   psql "postgresql://<user>:<pass>@<host>:5432/<db>" -f backend/migrations/0001_add_codes.sql

2) Ensure your Supabase schema cache is refreshed (Supabase updates schema cache automatically,
   but if you see PostgREST errors about missing columns, wait a few seconds or re-deploy the API).

3) Run the backfill script to populate codes for existing rows:

   source .venv/bin/activate
   python backend/scripts/backfill_codes.py

4) Optional: When you're happy with the backfilled values, you can make the columns NOT NULL:

   ALTER TABLE customers ALTER COLUMN customer_code SET NOT NULL;
   ALTER TABLE products ALTER COLUMN product_code SET NOT NULL;

   (Make sure there are no NULLs before running the above.)

Notes:
- The backfill script assigns codes in creation order (by created_at if present). It's best-effort
  and should be run once after migration. For high-concurrency production systems, consider using
  a DB sequence or single-row counters to generate atomic numeric suffixes.
