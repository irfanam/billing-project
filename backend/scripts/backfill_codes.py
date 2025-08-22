"""Backfill customer_code and product_code for existing rows.

Run this after applying the SQL migration in backend/migrations/0001_add_codes.sql.

Usage:
  source .venv/bin/activate
  python backend/scripts/backfill_codes.py

The script uses the project's Supabase client (app.database.supabase) and requires
SUPABASE_URL and SUPABASE_KEY to be set in the environment (the project's usual setup).
"""
import logging
from app.database import supabase


def parse_suffix(code: str, prefix: str) -> int:
    try:
        if not code or not code.startswith(prefix):
            return 0
        return int(code[len(prefix):])
    except Exception:
        return 0


def backfill(table: str, code_col: str, prefix: str):
    logging.info('Backfilling %s.%s with prefix %s', table, code_col, prefix)

    # check column exists
    try:
        existing = supabase.table(table).select(code_col).execute()
    except Exception as exc:
        logging.error('Column %s missing on table %s or API error: %s', code_col, table, exc)
        return

    # compute max existing suffix
    max_n = 0
    for r in (existing.data or []):
        val = r.get(code_col)
        n = parse_suffix(val, prefix)
        if n > max_n:
            max_n = n

    # find rows missing the code
    try:
        missing = supabase.table(table).select('*').is_(code_col, None).execute()
    except Exception as exc:
        logging.error('Error fetching rows missing %s: %s', code_col, exc)
        return

    rows = missing.data or []
    logging.info('Found %s rows missing %s in %s', len(rows), code_col, table)

    # sort by created_at if present, else by id
    rows.sort(key=lambda r: r.get('created_at') or r.get('id'))

    for r in rows:
        max_n += 1
        code = f"{prefix}{max_n:06d}"
        upd = {'%s' % code_col: code}
        try:
            res = supabase.table(table).update(upd).eq('id', r.get('id')).execute()
        except Exception as exc:
            logging.exception('Failed to update row %s in %s: %s', r.get('id'), table, exc)
            continue
        if getattr(res, 'error', None):
            logging.error('Update error for %s: %s', r.get('id'), res.error)
        else:
            logging.info('Updated %s -> %s', r.get('id'), code)


def main():
    logging.basicConfig(level=logging.INFO)
    backfill('customers', 'customer_code', 'CID')
    backfill('products', 'product_code', 'UID')


if __name__ == '__main__':
    main()
