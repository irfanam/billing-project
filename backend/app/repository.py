from typing import Optional, Dict, List
from app.database import supabase
import logging


def get_product(product_id: str) -> Optional[Dict]:
    """Return product row dict or None"""
    res = supabase.table('products').select('*').eq('id', product_id).single().execute()
    if getattr(res, 'error', None):
        logging.error('Supabase get_product error: %s', res.error)
        return None
    # supabase client returns .data as the row when using single()
    return res.data


def get_customer(customer_id: str) -> Optional[Dict]:
    res = supabase.table('customers').select('*').eq('id', customer_id).single().execute()
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
    res = supabase.table('invoices').insert(record).execute()
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
    res = supabase.table('invoice_items').insert(items).execute()
    if getattr(res, 'error', None):
        logging.error('Supabase insert_invoice_items error: %s', res.error)
        return False
    return True


def decrement_product_stock(product_id: str, qty: int) -> bool:
    """Decrease product stock_qty by qty (best-effort)."""
    try:
        # Use rpc or update: fetch current, subtract, update
        current = supabase.table('products').select('stock_qty').eq('id', product_id).single().execute()
        if getattr(current, 'error', None) or not current.data:
            logging.warning('Could not fetch product stock for %s', product_id)
            return False
        stock = int(current.data.get('stock_qty') or 0)
        new_stock = max(0, stock - int(qty))
        upd = supabase.table('products').update({'stock_qty': new_stock}).eq('id', product_id).execute()
        if getattr(upd, 'error', None):
            logging.error('Supabase update stock error for %s: %s', product_id, upd.error)
            return False
        return True
    except Exception as exc:
        logging.exception('decrement_product_stock exception: %s', exc)
        return False
