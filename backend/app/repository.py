from typing import Optional, Dict, List
import logging
import uuid
from decimal import Decimal


def _get_supabase():
    # lazy import to avoid import errors in tests that don't have top-level `app` module
    from app.database import supabase
    return supabase


def _next_sequential_id(table: str, prefix: str, width: int = 6) -> str:
    """Compute next sequential id for a table with given prefix.

    This fetches existing ids from the table and finds the max numeric suffix for ids
    that start with the prefix, then returns prefix + zero-padded next number.
    This is a best-effort approach and may race under concurrent writers.
    """
    try:
        supabase = _get_supabase()
        # Prefer atomic increment using a counters table if available
        counter_name = None
        if table == 'customers':
            counter_name = 'customer_code'
        elif table == 'suppliers':
            counter_name = 'supplier_code'

        if counter_name:
            try:
                # Use PostgREST update returning: increment and return new value
                qb = supabase.table('counters').update({'value': 'value + 1'}, returning='representation').eq('name', counter_name)
                # Note: postgrest python client does not allow arbitrary SQL in update; as a fallback use rpc if available
                res = supabase.rpc('increment_counter', { 'p_name': counter_name }).execute()
                if not getattr(res, 'error', None) and res.data:
                    val = res.data[0].get('value') if isinstance(res.data, list) else res.data.get('value')
                    if isinstance(val, int) or (isinstance(val, str) and val.isdigit()):
                        n = int(val)
                        return f"{prefix}{n:0{width}d}"
            except Exception:
                # counters not available or rpc not installed; fall back to scanning
                logging.info('Counters RPC not available; falling back to scan-based seq for %s', table)

        # Fallback: scan existing rows like before
        code_col = 'id'
        if table == 'customers':
            code_col = 'customer_code'
        elif table == 'suppliers':
            code_col = 'supplier_code'
        try:
            res = supabase.table(table).select(code_col).execute()
        except Exception:
            logging.warning('Code column %s not found in table %s; falling back to id for sequence detection. Apply migrations to persist codes.', code_col, table)
            res = supabase.table(table).select('id').execute()
        if getattr(res, 'error', None) or not res.data:
            return f"{prefix}{1:0{width}d}"
        max_n = 0
        for row in (res.data or []):
            val = row.get(code_col)
            if not val or not isinstance(val, str):
                continue
            if val.startswith(prefix):
                num_part = val[len(prefix):]
                try:
                    n = int(num_part)
                    if n > max_n:
                        max_n = n
                except Exception:
                    continue
        next_n = max_n + 1
        return f"{prefix}{next_n:0{width}d}"
    except Exception:
        logging.exception('Failed to compute next sequential id for %s', table)
        # fallback to uuid-like id with prefix
        return prefix + str(uuid.uuid4())


def get_product(product_id: str) -> Optional[Dict]:
    """Return product row dict or None"""
    supabase = _get_supabase()
    try:
        res = supabase.table('products').select('*').eq('id', product_id).single().execute()
    except Exception as exc:
        # Postgrest may raise when zero rows are returned or on other API errors; treat as not found
        logging.debug('Supabase get_product exception (treated as not found): %s', exc)
        return None
    if getattr(res, 'error', None):
        logging.error('Supabase get_product error: %s', res.error)
        return None
    return res.data


def get_customer(customer_id: str) -> Optional[Dict]:
    supabase = _get_supabase()
    try:
        res = supabase.table('customers').select('*').eq('id', customer_id).single().execute()
    except Exception as exc:
        # supabase/postgrest may raise on invalid input (eg. bad UUID) or other API errors
        logging.exception('Supabase get_customer exception: %s', exc)
        return None
    if getattr(res, 'error', None):
        logging.error('Supabase get_customer error: %s', res.error)
        return None
    return res.data


def create_invoice(record: Dict) -> Optional[Dict]:
    """
    Insert an invoice record and return the created invoice (as dict) or None on error.
    record: dict matching invoices table columns (invoice_number, customer_id, subtotal, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount, currency, issued_by)
    This function does a best-effort insert and returns the inserted row.
    """
    supabase = _get_supabase()
    # Convert Decimal objects to floats for JSON/POST compatibility
    # Also sanitize UUID-like fields (customer_id) to avoid DB errors when the caller provides
    # invalid values (e.g. the string 'nonexistent' used in tests).
    rec_sanitized = {}
    for k, v in record.items():
        # sanitize decimals
        if isinstance(v, Decimal):
            rec_sanitized[k] = float(v)
            continue

        # sanitize customer_id: ensure it's a valid UUID string, otherwise set to None
        if k == 'customer_id' and v is not None:
            try:
                # accepts both uuid.UUID and string; will raise on invalid
                if isinstance(v, str):
                    uuid.UUID(v)
                else:
                    # not a string; try to coerce
                    uuid.UUID(str(v))
                rec_sanitized[k] = v
            except Exception:
                logging.warning('create_invoice: invalid customer_id provided, clearing field before insert: %s', v)
                rec_sanitized[k] = None
            continue

        rec_sanitized[k] = v
    try:
        res = supabase.table('invoices').insert(rec_sanitized).execute()
    except Exception as exc:
        logging.exception('Supabase create_invoice exception: %s', exc)
        return None
    if getattr(res, 'error', None):
        logging.error('Supabase create_invoice error: %s', res.error)
        return None
    # res.data is typically a list of inserted rows
    data = res.data
    if isinstance(data, list):
        return data[0] if data else None
    return data


def delete_product(product_id: str) -> bool:
    """Delete a product row by id. Returns True on success, False otherwise."""
    supabase = _get_supabase()
    # Attempt to delete the product row; handle APIError which may be raised on FK constraint
    try:
        res = supabase.table('products').delete().eq('id', product_id).execute()
        if getattr(res, 'error', None):
            logging.error('Supabase delete_product error: %s', res.error)
            # fall through to attempt soft-delete
        else:
            return True
    except Exception as exc:
        # Postgrest raises APIError with DB error details; try to detect FK violation code
        msg = str(exc)
        logging.exception('Supabase delete_product exception: %s', exc)
        # If it's a foreign key violation, attempt soft-delete
        if '23503' in msg or 'foreign key constraint' in msg or 'is still referenced' in msg:
            logging.info('Detected FK constraint preventing product deletion; attempting soft-delete for %s', product_id)
        else:
            return False

    # Soft-delete fallback: try archived flag first; if schema lacks it, perform a safe anonymize update
    try:
        upd = supabase.table('products').update({'archived': True}).eq('id', product_id).execute()
        if getattr(upd, 'error', None):
            logging.error('Failed to soft-delete product %s via archived flag: %s', product_id, upd.error)
            # fall through to anonymize
        else:
            return True
    except Exception as exc:
        # archived column may not exist in schema cache
        logging.warning('archived column not available or soft-delete update failed: %s', exc)

    # Last-resort: perform a non-destructive anonymize update so product remains referenced but is inert and hidden.
    try:
        # fetch current product to craft a new sku/name
        cur = supabase.table('products').select('sku', 'name').eq('id', product_id).single().execute()
        sku = None
        name = None
        if cur and cur.data:
            sku = cur.data.get('sku')
            name = cur.data.get('name')
        new_sku = (sku or 'DELETED') + '-DELETED-' + product_id.split('-')[0]
        new_name = (name or 'Deleted Product') + ' [deleted]'
        upd2 = supabase.table('products').update({'sku': new_sku, 'name': new_name, 'price': 0.0, 'stock_qty': 0}).eq('id', product_id).execute()
        if getattr(upd2, 'error', None):
            logging.error('Failed to anonymize product %s during delete fallback: %s', product_id, upd2.error)
            return False
        return True
    except Exception as exc:
        logging.exception('Anonymize fallback failed for product %s: %s', product_id, exc)
        return False


def insert_invoice_items(invoice_id: str, items: List[Dict]) -> bool:
    """Insert multiple invoice items. items should be list of dicts with invoice_id included."""
    if not items:
        return True
    supabase = _get_supabase()
    # sanitize Decimal fields in items
    sanitized = []
    for it in items:
        it_copy = {}
        for k, v in it.items():
            if isinstance(v, Decimal):
                it_copy[k] = float(v)
            else:
                it_copy[k] = v
        sanitized.append(it_copy)
    try:
        res = supabase.table('invoice_items').insert(sanitized).execute()
    except Exception as exc:
        logging.exception('Supabase insert_invoice_items exception: %s', exc)
        return False
    if getattr(res, 'error', None):
        logging.error('Supabase insert_invoice_items error: %s', res.error)
        return False
    return True


def decrement_product_stock(product_id: str, qty: int, allow_negative: bool = False) -> bool:
    """Decrease product stock_qty by qty (best-effort).

    If allow_negative is True, the resulting stock quantity may go below zero (oversell).
    """
    try:
        # Use rpc or update: fetch current, subtract, update
        supabase = _get_supabase()
        current = supabase.table('products').select('stock_qty').eq('id', product_id).single().execute()
        if getattr(current, 'error', None) or not current.data:
            logging.warning('Could not fetch product stock for %s', product_id)
            return False
        stock = int(current.data.get('stock_qty') or 0)
        if allow_negative:
            new_stock = stock - int(qty)
        else:
            new_stock = max(0, stock - int(qty))
        upd = supabase.table('products').update({'stock_qty': new_stock}).eq('id', product_id).execute()
        if getattr(upd, 'error', None):
            logging.error('Supabase update stock error for %s: %s', product_id, upd.error)
            return False
        return True
    except Exception as exc:
        logging.exception('decrement_product_stock exception: %s', exc)
        return False


def get_invoice(invoice_id: str) -> Optional[Dict]:
    """Fetch invoice with items and customer info. Returns dict or None."""
    try:
        supabase = _get_supabase()
        inv_res = supabase.table('invoices').select('*').eq('id', invoice_id).single().execute()
        if getattr(inv_res, 'error', None) or not inv_res.data:
            logging.warning('Invoice not found: %s', invoice_id)
            return None
        invoice = inv_res.data
        items_res = supabase.table('invoice_items').select('*').eq('invoice_id', invoice_id).execute()
        items = items_res.data if not getattr(items_res, 'error', None) else []
        customer = None
        if invoice.get('customer_id'):
            cust_res = supabase.table('customers').select('*').eq('id', invoice.get('customer_id')).single().execute()
            if not getattr(cust_res, 'error', None):
                customer = cust_res.data
        invoice['items'] = items
        invoice['customer'] = customer
        return invoice
    except Exception as exc:
        logging.exception('get_invoice exception: %s', exc)
        return None


def list_invoices(limit: Optional[int] = None) -> Optional[List[Dict]]:
    """Return a list of invoices. If limit is provided, limit the number of rows returned."""
    try:
        supabase = _get_supabase()
        qb = supabase.table('invoices').select('*')
        if limit:
            # postgrest expects limit as int
            qb = qb.limit(int(limit))
        res = qb.execute()
        if getattr(res, 'error', None):
            logging.error('Supabase list_invoices error: %s', res.error)
            return None
        return res.data or []
    except Exception as exc:
        logging.exception('list_invoices exception: %s', exc)
        return None


def create_customer(record: Dict) -> Optional[Dict]:
    """Insert a customer record and return the created row or None on error."""
    try:
        supabase = _get_supabase()
        rec = record.copy()
        # ensure id exists as UUID for DB integrity
        if not rec.get('id'):
            rec['id'] = str(uuid.uuid4())

        # Retry loop: compute next code and try to insert with code; on unique conflict, retry a few times
        max_attempts = 5
        for attempt in range(max_attempts):
            code = _next_sequential_id('customers', 'CID')
            rec_with_code = rec.copy()
            rec_with_code['customer_code'] = code
            try:
                res = supabase.table('customers').insert(rec_with_code).execute()
            except Exception as exc:
                # If the DB/PostgREST reports that the column does not exist, fall back to inserting without the code
                msg = str(exc)
                logging.exception('Supabase create_customer exception on insert: %s', exc)
                if 'customer_code' in msg or 'column customers.customer_code does not exist' in msg or 'Could not find the' in msg:
                    logging.warning('customers.customer_code column not present; inserting without code and returning computed code in response. Apply migration to persist codes.')
                    try:
                        res2 = supabase.table('customers').insert(rec).execute()
                    except Exception:
                        logging.exception('Fallback insert without customer_code also failed')
                        return None
                    if getattr(res2, 'error', None):
                        logging.error('Fallback create_customer insert error: %s', res2.error)
                        return None
                    data = res2.data
                    if isinstance(data, list):
                        out = data[0] if data else None
                    else:
                        out = data
                    if out is not None and isinstance(out, dict):
                        out['customer_code'] = code
                    return out
                return None
            if getattr(res, 'error', None):
                # detect unique constraint on customer_code and retry
                err = res.error
                logging.error('Supabase create_customer error (attempt %s): %s', attempt + 1, err)
                if isinstance(err, dict) and 'message' in err and 'duplicate' in err['message'].lower():
                    # conflict on code, retry
                    continue
                return None
            data = res.data
            if isinstance(data, list):
                out = data[0] if data else None
            else:
                out = data
            if out is not None and isinstance(out, dict):
                out['customer_code'] = code
            return out
        logging.error('Failed to create customer after %s attempts due to code conflicts', max_attempts)
        return None
    except Exception as exc:
        logging.exception('Supabase create_customer exception: %s', exc)
        return None


def list_suppliers() -> Optional[List[Dict]]:
    try:
        supabase = _get_supabase()
        res = supabase.table('suppliers').select('*').execute()
        if getattr(res, 'error', None):
            logging.error('Supabase list_suppliers error: %s', res.error)
            return None
        return res.data or []
    except Exception:
        logging.exception('list_suppliers exception')
        return None


def create_supplier(record: Dict) -> Optional[Dict]:
    try:
        supabase = _get_supabase()
        rec = record.copy()
        if not rec.get('id'):
            rec['id'] = str(uuid.uuid4())

        max_attempts = 5
        for attempt in range(max_attempts):
            code = _next_sequential_id('suppliers', 'SID')
            rec_with_code = rec.copy()
            rec_with_code['supplier_code'] = code
            try:
                res = supabase.table('suppliers').insert(rec_with_code).execute()
            except Exception as exc:
                msg = str(exc)
                logging.exception('Supabase create_supplier exception on insert: %s', exc)
                if 'supplier_code' in msg or 'column suppliers.supplier_code does not exist' in msg or 'Could not find the' in msg:
                    logging.warning('suppliers.supplier_code column not present; inserting without code and returning computed code in response. Apply migration to persist codes.')
                    try:
                        res2 = supabase.table('suppliers').insert(rec).execute()
                    except Exception:
                        logging.exception('Fallback insert without supplier_code also failed')
                        return None
                    if getattr(res2, 'error', None):
                        logging.error('Fallback create_supplier insert error: %s', res2.error)
                        return None
                    data = res2.data
                    if isinstance(data, list):
                        out = data[0] if data else None
                    else:
                        out = data
                    if out is not None and isinstance(out, dict):
                        out['supplier_code'] = code
                    return out
                return None
            if getattr(res, 'error', None):
                err = res.error
                logging.error('Supabase create_supplier error (attempt %s): %s', attempt + 1, err)
                if isinstance(err, dict) and 'message' in err and 'duplicate' in err['message'].lower():
                    continue
                return None
            data = res.data
            if isinstance(data, list):
                out = data[0] if data else None
            else:
                out = data
            if out is not None and isinstance(out, dict):
                out['supplier_code'] = code
            return out
        logging.error('Failed to create supplier after %s attempts due to code conflicts', max_attempts)
        return None
    except Exception as exc:
        logging.exception('Supabase create_supplier exception: %s', exc)
        return None


def apply_purchase(supplier_id: str, items: List[Dict], received_by: Optional[str] = None) -> Optional[Dict]:
    """Record a purchase and increase product stock. Returns movement record or None on error."""
    try:
        supabase = _get_supabase()
        # insert a purchase record in purchases table if exists (best-effort); otherwise just update stock
        for it in items:
            pid = it.get('product_id')
            qty = int(it.get('qty', 0))
            # create stock movement (positive change)
            mv = create_stock_movement(pid, int(qty), 'purchase', reference_type='supplier', reference_id=supplier_id, unit_cost=it.get('unit_cost'), created_by=received_by)
            if not mv:
                logging.error('Failed to create stock movement for purchase of %s qty %s', pid, qty)
                return None
        return {'status': 'ok'}
    except Exception as exc:
        logging.exception('apply_purchase exception: %s', exc)
        return None


def apply_sale(customer_id: Optional[str], items: List[Dict], issued_by: Optional[str] = None, allow_oversale: bool = False) -> Optional[Dict]:
    """Record a sale: create invoice-like movement and decrement stock. Returns summary or None."""
    try:
        # Similar to invoice creation: reserve/consume or decrement
        reservations = []
        for it in items:
            pid = it.get('product_id')
            qty = int(it.get('qty', 0))
            # attempt reservation
            res = reserve_stock(pid, qty, None, None, issued_by)
            if res is None:
                # try oversell decrement
                decremented = decrement_product_stock(pid, qty, allow_negative=allow_oversale)
                if not decremented:
                    # rollback any previous reservations
                    for r in reservations:
                        try:
                            release_reservation(r.get('id'), 'sale-abort')
                        except Exception:
                            logging.exception('Failed to release reservation')
                    logging.error('Insufficient stock for product %s', pid)
                    return None
            else:
                reservations.append(res)

        # consume reservations
        for r in reservations:
            consume_reservation(r.get('id'), issued_by)

        return {'status': 'ok'}
    except Exception as exc:
        logging.exception('apply_sale exception: %s', exc)
        return None


def list_product_variables(vtype: str) -> Optional[List[str]]:
    try:
        supabase = _get_supabase()
        # Some versions of the supabase client have different .order() signatures.
        # To be robust, fetch relevant columns and sort in Python.
        # Try to include the `enabled` column and filter enabled entries when possible.
        try:
            # attempt to filter by enabled true (newer schema)
            res = supabase.table('product_variables').select('value, value_num, sort_order, created_at, enabled').eq('vtype', vtype).eq('enabled', True).execute()
        except Exception:
            # fallback: schema may not have `enabled`, select without filter
            res = supabase.table('product_variables').select('value, value_num, sort_order, created_at, enabled').eq('vtype', vtype).execute()
        if getattr(res, 'error', None):
            logging.error('list_product_variables error: %s', res.error)
            return None
        rows = res.data or []
        # sort by sort_order then created_at
        try:
            rows_sorted = sorted(rows, key=lambda r: (r.get('sort_order') or 0, r.get('created_at') or ''))
        except Exception:
            rows_sorted = rows
        # Return rows (as dicts) so callers can inspect enabled/value_num etc.
        # Also attach the vtype-enabled flag (if present) so callers can know if the whole type is enabled.
        try:
            tv = supabase.table('product_variable_types').select('enabled').eq('vtype', vtype).single().execute()
            vtype_enabled = True
            if getattr(tv, 'error', None) or not tv.data:
                vtype_enabled = True
            else:
                vtype_enabled = bool(tv.data.get('enabled'))
        except Exception:
            vtype_enabled = True
        return {'vtype_enabled': vtype_enabled, 'rows': rows_sorted}
    except Exception:
        logging.exception('list_product_variables exception')
        return None


def upsert_product_variable(vtype: str, value: str) -> Optional[Dict]:
    try:
        supabase = _get_supabase()
        # best-effort: insert and ignore duplicates
        payload = {'vtype': vtype, 'value': value, 'enabled': True}
        if vtype == 'gst':
            # normalize numeric GST values into value_num for easier querying
            try:
                payload['value_num'] = float(value)
            except Exception:
                # leave value_num null if parsing fails
                pass
        try:
            res = supabase.table('product_variables').insert(payload).execute()
        except Exception as exc:
            msg = str(exc)
            # fallback: some Supabase/PostgREST instances may not have value_num column yet.
            if 'value_num' in msg or "Could not find the 'value_num'" in msg:
                try:
                    # remove value_num and retry
                    payload.pop('value_num', None)
                    res = supabase.table('product_variables').insert(payload).execute()
                except Exception:
                    raise
            else:
                raise
        if getattr(res, 'error', None):
            logging.error('upsert_product_variable error: %s', res.error)
            return None
        data = res.data
        if isinstance(data, list):
            return data[0] if data else None
        return data
    except Exception:
        logging.exception('upsert_product_variable exception')
        return None


def delete_product_variable(vtype: str, value: str) -> bool:
    try:
        supabase = _get_supabase()
        res = supabase.table('product_variables').delete().eq('vtype', vtype).eq('value', value).execute()
        if getattr(res, 'error', None):
            logging.error('delete_product_variable error: %s', res.error)
            return False
        return True
    except Exception:
        logging.exception('delete_product_variable exception')
        return False


def update_product_variable_enabled(vtype: str, value: str, enabled: bool) -> bool:
    """Set the enabled flag on a product variable row identified by vtype+value."""
    try:
        supabase = _get_supabase()
        res = supabase.table('product_variables').update({'enabled': bool(enabled)}).eq('vtype', vtype).eq('value', value).execute()
        if getattr(res, 'error', None):
            logging.error('update_product_variable_enabled error: %s', res.error)
            return False
        return True
    except Exception:
        logging.exception('update_product_variable_enabled exception')
        return False


def set_product_variable_type_enabled(vtype: str, enabled: bool) -> bool:
    """Enable or disable an entire variable type (e.g., company, variant, gst)."""
    try:
        supabase = _get_supabase()
        # Upsert into product_variable_types
        try:
            res = supabase.table('product_variable_types').upsert({'vtype': vtype, 'enabled': bool(enabled)}).execute()
        except Exception:
            # Fallback: try update then insert
            try:
                res = supabase.table('product_variable_types').update({'enabled': bool(enabled)}).eq('vtype', vtype).execute()
                if getattr(res, 'error', None):
                    # insert if update did not find a row
                    res2 = supabase.table('product_variable_types').insert({'vtype': vtype, 'enabled': bool(enabled)}).execute()
            except Exception:
                logging.exception('set_product_variable_type_enabled upsert fallback failed')
                return False
        return True
    except Exception:
        logging.exception('set_product_variable_type_enabled exception')
        return False


def list_product_variable_types_all() -> Dict[str, bool]:
    """Return a mapping of vtype -> enabled (bool) for all known variable types.

    If the `product_variable_types` table is not available, return defaults (all enabled).
    """
    defaults = { 'company': True, 'variant': True, 'gst': True, 'type': True }
    try:
        supabase = _get_supabase()
        try:
            res = supabase.table('product_variable_types').select('vtype, enabled').execute()
        except Exception:
            # table may not exist on older DB; return defaults
            return defaults
        if getattr(res, 'error', None):
            logging.error('list_product_variable_types_all error: %s', res.error)
            return defaults
        rows = res.data or []
        out = {}
        for r in rows:
            if not r or not isinstance(r, dict):
                continue
            vt = r.get('vtype')
            en = r.get('enabled')
            if vt:
                out[vt] = bool(en) if en is not None else True
        # ensure known defaults present
        for k, v in defaults.items():
            out.setdefault(k, v)
        return out
    except Exception:
        logging.exception('list_product_variable_types_all exception')
        return defaults


def update_customer(customer_id: str, changes: Dict) -> Optional[Dict]:
    """Perform partial update on customer record and return updated row or None."""
    try:
        supabase = _get_supabase()
        # sanitize if Decimal present (unlikely for customer)
        rec = {}
        for k, v in changes.items():
            if isinstance(v, Decimal):
                rec[k] = float(v)
            else:
                rec[k] = v
        res = supabase.table('customers').update(rec).eq('id', customer_id).execute()
        if getattr(res, 'error', None):
            logging.error('Supabase update_customer error: %s', res.error)
            return None
        data = res.data
        if isinstance(data, list):
            return data[0] if data else None
        return data
    except Exception as exc:
        logging.exception('update_customer exception: %s', exc)
        return None


def delete_customer(customer_id: str) -> bool:
    """Delete a customer by id. Returns True on success, False otherwise."""
    try:
        supabase = _get_supabase()
        res = supabase.table('customers').delete().eq('id', customer_id).execute()
        if getattr(res, 'error', None):
            logging.error('Supabase delete_customer error: %s', res.error)
            return False
        return True
    except Exception:
        logging.exception('delete_customer exception')
        return False


def create_product(record: Dict) -> Optional[Dict]:
    """Insert a product record and return the created row or None on error. Uses UID... ids."""
    try:
        supabase = _get_supabase()
        rec = record.copy()
        # If caller provided a `meta` object, extract well-known product variables
        # into top-level columns so we don't persist JSONB meta anymore.
        meta = rec.get('meta')
        if meta:
            # meta may be a JSON string in some clients
            if isinstance(meta, str):
                try:
                    import json
                    meta = json.loads(meta)
                except Exception:
                    meta = None
            if isinstance(meta, dict):
                for fld in ('company', 'variant', 'type', 'selling_price', 'p_code', 'product_code'):
                    if fld in meta and meta.get(fld) is not None:
                        # convert selling_price decimals to float when needed
                        if fld == 'selling_price':
                            val = meta.get(fld)
                            if isinstance(val, Decimal):
                                rec[fld] = float(val)
                            else:
                                rec[fld] = val
                        else:
                            rec[fld] = meta.get(fld)
            # Always drop 'meta' from the payload to avoid writing JSONB into products table
            rec.pop('meta', None)
        if not rec.get('id'):
            rec['id'] = str(uuid.uuid4())
        # sanitize Decimal fields
        for k, v in list(rec.items()):
            if isinstance(v, Decimal):
                rec[k] = float(v)
        # Single-attempt insert: we no longer write a JSONB `meta` column for products.
        try:
            res = supabase.table('products').insert(rec).execute()
        except Exception as exc:
            logging.exception('Supabase create_product exception on insert: %s', exc)
            return None

        if getattr(res, 'error', None):
            logging.error('Supabase create_product returned error: %s', res.error)
            return None
        data = res.data
        out = data[0] if isinstance(data, list) and data else data
        # prefer returning UID if it already exists in top-level p_code/product_code
        if out is not None and isinstance(out, dict):
            if out.get('p_code'):
                out['product_code'] = out.get('p_code')
            elif out.get('product_code'):
                out['product_code'] = out.get('product_code')
        return out
    except Exception as exc:
        logging.exception('Supabase create_product exception: %s', exc)
        return None


def list_products() -> Optional[List[Dict]]:
    """Return products list and compute server-side total_price (price + gst)."""
    try:
        supabase = _get_supabase()
        # Prefer to exclude archived products if the column exists
        try:
            res = supabase.table('products').select('*').neq('archived', True).execute()
        except Exception:
            # If the archived column does not exist, fall back to selecting all and filter anonymized deletions
            logging.debug('products.archived column not present; returning non-deleted products by name marker.')
            res = supabase.table('products').select('*').execute()
        if getattr(res, 'error', None):
            logging.error('Supabase list_products error: %s', res.error)
            return None
        rows = res.data or []
        out = []
        for r in rows:
            prod = r.copy() if isinstance(r, dict) else dict(r)
            # Skip anonymized deleted products (name marker)
            nm = prod.get('name')
            if isinstance(nm, str) and nm.endswith(' [deleted]'):
                continue
            price = prod.get('price')
            tax = prod.get('tax_percent')
            try:
                if price is None:
                    prod['total_price'] = None
                else:
                    # coerce to float for JSON friendliness
                    p = float(price) if not isinstance(price, Decimal) else float(price)
                    t = float(tax) if tax is not None else 0.0
                    prod['total_price'] = round(p + (p * (t / 100.0)), 2)
            except Exception:
                prod['total_price'] = None
            out.append(prod)
        return out
    except Exception:
        logging.exception('list_products exception')
        return None


def list_archived_products() -> Optional[List[Dict]]:
    """Return products that are archived or anonymized (name ends with ' [deleted]')."""
    try:
        supabase = _get_supabase()
        try:
            res = supabase.table('products').select('*').eq('archived', True).execute()
        except Exception:
            # archived column missing: select all and filter name markers
            res = supabase.table('products').select('*').execute()
        if getattr(res, 'error', None):
            logging.error('Supabase list_archived_products error: %s', res.error)
            return None
        rows = res.data or []
        out = []
        for r in rows:
            prod = r.copy() if isinstance(r, dict) else dict(r)
            nm = prod.get('name')
            if prod.get('archived') is True or (isinstance(nm, str) and nm.endswith(' [deleted]')):
                out.append(prod)
        return out
    except Exception:
        logging.exception('list_archived_products exception')
        return None


def undelete_product(product_id: str) -> bool:
    """Attempt to reverse anonymize/archived markers on a product. Returns True on success."""
    try:
        supabase = _get_supabase()
        # If archived column exists, simply set it to False
        try:
            upd = supabase.table('products').update({'archived': False}).eq('id', product_id).execute()
            if not getattr(upd, 'error', None) and upd.data:
                return True
        except Exception:
            # archived column may not exist; fall back to try to revert anonymize pattern in name/sku
            pass

        # Fetch current product to try to restore name/sku where possible. Note: we can't know original values reliably
        cur = supabase.table('products').select('sku', 'name').eq('id', product_id).single().execute()
        if getattr(cur, 'error', None) or not cur.data:
            logging.warning('undelete_product: product not found %s', product_id)
            return False
        sku = cur.data.get('sku')
        name = cur.data.get('name')
        # Attempt best-effort revert: remove ' [deleted]' suffix from name and strip '-DELETED-<idprefix>' from sku
        new_name = name
        if isinstance(name, str) and name.endswith(' [deleted]'):
            new_name = name[:-10]
        new_sku = sku
        if isinstance(sku, str) and '-DELETED-' in sku:
            new_sku = sku.split('-DELETED-')[0]
        upd2 = supabase.table('products').update({'sku': new_sku, 'name': new_name}).eq('id', product_id).execute()
        if getattr(upd2, 'error', None):
            logging.error('undelete_product failed update: %s', upd2.error)
            return False
        return True
    except Exception as exc:
        logging.exception('undelete_product exception: %s', exc)
        return False


def update_product(product_id: str, changes: Dict) -> Optional[Dict]:
    """Perform partial update on product record with graceful fallback for missing columns like meta."""
    try:
        supabase = _get_supabase()
        # Build the update payload, extracting any known product variables from a provided `meta` key
        rec = {}
        # If caller sent a meta payload, extract known fields into top-level columns
        meta = None
        if 'meta' in changes:
            meta = changes.get('meta')
        if meta:
            if isinstance(meta, str):
                try:
                    import json
                    meta = json.loads(meta)
                except Exception:
                    meta = None
            if isinstance(meta, dict):
                for fld in ('company', 'variant', 'type', 'selling_price', 'p_code', 'product_code'):
                    if fld in meta and meta.get(fld) is not None:
                        if fld == 'selling_price' and isinstance(meta.get(fld), Decimal):
                            rec[fld] = float(meta.get(fld))
                        else:
                            rec[fld] = meta.get(fld)

        # Add other explicit changes (non-meta)
        for k, v in changes.items():
            if k == 'meta':
                continue
            if isinstance(v, Decimal):
                rec[k] = float(v)
            else:
                rec[k] = v

        try:
            res = supabase.table('products').update(rec).eq('id', product_id).execute()
        except Exception as exc:
            logging.exception('Supabase update_product exception: %s', exc)
            return None

        if getattr(res, 'error', None):
            logging.error('Supabase update_product error: %s', res.error)
            return None
        data = res.data
        if isinstance(data, list):
            return data[0] if data else None
        return data
    except Exception as exc:
        logging.exception('update_product exception: %s', exc)
        return None


# Stock primitives
def get_current_stock(product_id: str) -> Optional[Dict]:
    """Return cached stock_qty from products and reserved qty (sum of active reservations).

    Returns a dict: {'on_hand': int, 'reserved': int, 'available': int} or None on error.
    """
    try:
        supabase = _get_supabase()
        prod = supabase.table('products').select('stock_qty').eq('id', product_id).single().execute()
        stock = int(prod.data.get('stock_qty') or 0) if prod and prod.data else 0

        # fake/test proxy expects a single eq('product_id', ...) call; it will only return active reservations
        res = supabase.table('stock_reservations').select('qty').eq('product_id', product_id).execute()
        reserved = sum([r.get('qty', 0) for r in (res.data or [])]) if res and res.data else 0

        return {'on_hand': stock, 'reserved': reserved, 'available': stock - reserved}
    except Exception:
        logging.exception('get_current_stock error')
        return None


def create_stock_movement(product_id: str, change: int, reason: str, reference_type: str = None, reference_id: str = None, unit_cost: Optional[float] = None, created_by: Optional[str] = None, meta: Optional[dict] = None) -> Optional[Dict]:
    """Insert a stock_movement and update cached products.stock_qty (best-effort).
    Note: Supabase client does not expose DB-level transactions here; this is best-effort and should be wrapped server-side if strong consistency is required.
    """
    try:
        supabase = _get_supabase()
        # sanitize unit_cost if Decimal
        if isinstance(unit_cost, Decimal):
            unit_cost = float(unit_cost)
        mv = {
            'product_id': product_id,
            'change': change,
            'reason': reason,
            'reference_type': reference_type,
            'reference_id': reference_id,
            'unit_cost': unit_cost,
            'created_by': created_by,
            # keep metadata attached to stock_movements table only; do not copy into products
            'meta': meta,
        }
        res = supabase.table('stock_movements').insert(mv).execute()
        if getattr(res, 'error', None):
            logging.error('create_stock_movement error: %s', res.error)
            return None

    # update cached product stock_qty by adding change (do not touch product.meta)
        # fetch current
        cur = supabase.table('products').select('stock_qty').eq('id', product_id).single().execute()
        if not getattr(cur, 'error', None) and cur.data:
            stock = int(cur.data.get('stock_qty') or 0)
            new_stock = stock + int(change)
            upd = supabase.table('products').update({'stock_qty': new_stock}).eq('id', product_id).execute()
            if getattr(upd, 'error', None):
                logging.warning('Failed to update products.stock_qty for %s: %s', product_id, upd.error)

        data = res.data
        if isinstance(data, list):
            return data[0] if data else None
        return data
    except Exception as exc:
        logging.exception('create_stock_movement exception: %s', exc)
        return None


def reserve_stock(product_id: str, qty: int, invoice_id: Optional[str] = None, expires_at: Optional[str] = None, created_by: Optional[str] = None, meta: Optional[dict] = None) -> Optional[Dict]:
    """Attempt to reserve stock. Returns reservation row or None on failure/insufficient stock."""
    try:
        # check availability
        cur = get_current_stock(product_id)
        if cur is None:
            return None
        if cur['available'] < qty:
            logging.info('Insufficient available stock for %s: need %s available %s', product_id, qty, cur['available'])
            return None

        supabase = _get_supabase()
        rec = {
            'product_id': product_id,
            'qty': qty,
            'invoice_id': invoice_id,
            'expires_at': expires_at,
            'created_by': created_by,
            # store reservation metadata in reservations table only
            'meta': meta,
        }
        res = supabase.table('stock_reservations').insert(rec).execute()
        if getattr(res, 'error', None):
            logging.error('reserve_stock insert error: %s', res.error)
            return None
        data = res.data
        if isinstance(data, list):
            return data[0] if data else None
        return data
    except Exception as exc:
        logging.exception('reserve_stock exception: %s', exc)
        return None


def consume_reservation(reservation_id: str, created_by: Optional[str] = None) -> bool:
    """Mark reservation consumed and create final stock movement (outbound)."""
    try:
        supabase = _get_supabase()
        # Update the reservation to consumed and get the updated row (test proxy returns the row on update)
        upd = supabase.table('stock_reservations').update({'status': 'consumed'}).eq('id', reservation_id).execute()
        if getattr(upd, 'error', None) or not upd.data:
            logging.warning('Reservation not found or update failed: %s', reservation_id)
            return False
        rec = upd.data[0]
        if rec.get('status') != 'consumed':
            logging.warning('Reservation status unexpected after update: %s', rec.get('status'))
            return False

        # create movement (negative change)
        mv = create_stock_movement(rec['product_id'], -int(rec['qty']), 'sale', reference_type='reservation', reference_id=reservation_id, created_by=created_by)
        if not mv:
            logging.error('Failed to create movement for reservation %s', reservation_id)
            return False
        return True
    except Exception as exc:
        logging.exception('consume_reservation exception: %s', exc)
        return False


def release_reservation(reservation_id: str, reason: str = 'released') -> bool:
    """Release a reservation without creating movement (reservation was not consumed)."""
    try:
        supabase = _get_supabase()
        # Update reservation status to released and return status
        upd = supabase.table('stock_reservations').update({'status': 'released', 'meta': {'released_reason': reason}}).eq('id', reservation_id).execute()
        if getattr(upd, 'error', None) or not upd.data:
            logging.warning('Failed to mark reservation released %s: %s', reservation_id, getattr(upd, 'error', None))
            return False
        return True
    except Exception as exc:
        logging.exception('release_reservation exception: %s', exc)
        return False
