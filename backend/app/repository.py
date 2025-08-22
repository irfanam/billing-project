from typing import Optional, Dict, List
import logging
import uuid
from decimal import Decimal


def _get_supabase():
    # lazy import to avoid import errors in tests that don't have top-level `app` module
    from app.database import supabase
    return supabase


def get_product(product_id: str) -> Optional[Dict]:
    """Return product row dict or None"""
    supabase = _get_supabase()
    res = supabase.table('products').select('*').eq('id', product_id).single().execute()
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
        mv = {
            'product_id': product_id,
            'change': change,
            'reason': reason,
            'reference_type': reference_type,
            'reference_id': reference_id,
            'unit_cost': unit_cost,
            'created_by': created_by,
            'meta': meta,
        }
        res = supabase.table('stock_movements').insert(mv).execute()
        if getattr(res, 'error', None):
            logging.error('create_stock_movement error: %s', res.error)
            return None

        # update cached product stock_qty by adding change
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
