from fastapi import APIRouter, HTTPException
from typing import TYPE_CHECKING
from starlette.concurrency import run_in_threadpool
from . import repository
from . import tax as tax_module
from .schemas import InvoiceCreate
import logging
import uuid
import os
from fastapi.responses import Response, HTMLResponse
from . import pdf as pdf_module

if TYPE_CHECKING:
    # imported for type-checking only to avoid importing top-level `app` package during tests
    from app.models import BillingRecord


router = APIRouter(prefix="/billing", tags=["Billing"])
from fastapi import Body
from .schemas import Product


def _insert_billing(record_dict: dict):
    # import supabase lazily to avoid top-level dependency on the `app` package during tests
    from backend.app.database import supabase
    return supabase.table('billing').insert(record_dict).execute()


def _select_billing(user_id: str):
    from app.database import supabase
    return supabase.table('billing').select('*').eq('user_id', user_id).execute()


@router.post("/")
async def create_billing(record: 'BillingRecord'):
    # billing creation uses the legacy app.supabase client; import inside to keep module import-safe
    res = await run_in_threadpool(_insert_billing, record.dict())
    if getattr(res, 'error', None):
        logging.error('Supabase insert error: %s', res.error)
        raise HTTPException(status_code=500, detail=str(res.error))
    return {"status": "success", "data": res.data}


@router.get("/{user_id}")
async def get_billing(user_id: str):
    res = await run_in_threadpool(_select_billing, user_id)
    if getattr(res, 'error', None):
        logging.error('Supabase select error: %s', res.error)
        raise HTTPException(status_code=500, detail=str(res.error))
    return {"status": "success", "data": res.data}


# New invoice creation route
@router.get('/products')
async def list_products():
    from app.database import supabase
    res = supabase.table('products').select('*').execute()
    if getattr(res, 'error', None):
        raise HTTPException(status_code=500, detail=str(res.error))
    return {"status": "success", "data": res.data}

@router.post('/products')
async def create_product(product: Product = Body(...)):
    from app.database import supabase
    try:
        rec = product.dict(exclude_unset=True)
        res = supabase.table('products').insert(rec).execute()
        if getattr(res, 'error', None):
            raise HTTPException(status_code=500, detail=str(res.error))
        return {"status": "success", "data": res.data}
    except Exception as exc:
        import logging
        logging.exception('Product validation error: %s', exc)
        raise

@router.put('/products/{product_id}')
async def update_product(product_id: str, product: Product = Body(...)):
    from app.database import supabase
    rec = product.dict(exclude_unset=True)
    res = supabase.table('products').update(rec).eq('id', product_id).execute()
    if getattr(res, 'error', None):
        raise HTTPException(status_code=500, detail=str(res.error))
    return {"status": "success", "data": res.data}
@router.post('/invoices/')
async def create_invoice(payload: InvoiceCreate):
    # Resolve product tax_percent when not provided per-line
    items_for_tax = []
    for it in payload.items:
        taxp = it.tax_percent
        if taxp is None and it.product_id:
            prod = await run_in_threadpool(repository.get_product, it.product_id)
            if prod and prod.get('tax_percent') is not None:
                taxp = prod.get('tax_percent')
        items_for_tax.append({'qty': it.qty, 'unit_price': it.unit_price, 'tax_percent': taxp})

    # fetch customer to determine state for intra/inter state tax
    customer = await run_in_threadpool(repository.get_customer, payload.customer_id)
    supplier_state = None
    customer_state = None
    if customer:
        customer_state = customer.get('state')

    # supplier_state should usually be the business's registered state.
    # Use SUPPLIER_STATE env var if provided, otherwise default to 'Karnataka'.
    supplier_state = os.getenv('SUPPLIER_STATE', 'Karnataka')

    taxes = tax_module.calculate_invoice_taxes(supplier_state, customer_state, items_for_tax)

    invoice_number = str(uuid.uuid4())[:8]
    invoice_record = {
        'invoice_number': invoice_number,
        'customer_id': payload.customer_id,
        'subtotal': taxes['subtotal'],
        'cgst_amount': taxes['cgst'],
        'sgst_amount': taxes['sgst'],
        'igst_amount': taxes['igst'],
        'total_tax': taxes['total_tax'],
        'total_amount': taxes['total'],
        'currency': 'INR',
        'issued_by': payload.issued_by,
    }

    # Reserve stock for each product before creating an invoice to avoid oversell.
    # We keep track of created reservations so we can release them if something fails.
    reservations = []
    try:
        for it in payload.items:
            if it.product_id:
                # Probe current stock first; in test envs this may return None (no DB available).
                try:
                    cur = await run_in_threadpool(repository.get_current_stock, it.product_id)
                except Exception:
                    cur = None

                if cur is None:
                    logging.info('Skipping reservations: no database available in this environment')
                    res = 'SKIPPED_NO_DB'
                else:
                    # Try to reserve from DB; reserve_stock will return None on insufficient stock
                    res = await run_in_threadpool(repository.reserve_stock, it.product_id, it.qty, None, None, payload.issued_by)

                if res is None:
                    # insufficient stock or error - release any previous reservations and abort
                    logging.info('Failed to reserve stock for product %s qty %s', it.product_id, it.qty)
                    raise HTTPException(status_code=409, detail=f'Insufficient stock for product {it.product_id}')
                if res != 'SKIPPED_NO_DB':
                    reservations.append(res)

        # All reservations succeeded; create invoice and items
        created = await run_in_threadpool(repository.create_invoice, invoice_record)
        if not created:
            raise HTTPException(status_code=500, detail='Failed to create invoice')

        # prepare and insert invoice items
        items_to_insert = []
        for it in payload.items:
            items_to_insert.append({
                'invoice_id': created.get('id'),
                'product_id': it.product_id,
                'description': it.description,
                'qty': it.qty,
                'unit_price': it.unit_price,
                'line_total': (it.unit_price * it.qty),
            })

        ok = await run_in_threadpool(repository.insert_invoice_items, created.get('id'), items_to_insert)
        if not ok:
            logging.warning('Invoice created but failed to insert items')

        # If we created reservations, consume them (preferred).
        # If reservations were skipped (no DB in test env), fall back to best-effort decrement_product_stock.
        if reservations:
            for r in reservations:
                try:
                    await run_in_threadpool(repository.consume_reservation, r.get('id'), payload.issued_by)
                except Exception:
                    logging.exception('Failed to consume reservation %s', r.get('id'))
        else:
            # best-effort decrement for environments without reservations
            for it in payload.items:
                if it.product_id:
                    try:
                        await run_in_threadpool(repository.decrement_product_stock, it.product_id, it.qty)
                    except Exception:
                        logging.exception('decrement_product_stock failed for %s', it.product_id)

        return {"status": "success", "data": created}
    except HTTPException:
        # release any reservations we created
        for r in reservations:
            try:
                await run_in_threadpool(repository.release_reservation, r.get('id'), 'invoice-abort')
            except Exception:
                logging.exception('Failed to release reservation %s', r.get('id'))
        raise
    except Exception:
        # unexpected failure: release reservations and surface 500
        for r in reservations:
            try:
                await run_in_threadpool(repository.release_reservation, r.get('id'), 'invoice-error')
            except Exception:
                logging.exception('Failed to release reservation %s', r.get('id'))
        raise HTTPException(status_code=500, detail='Internal error creating invoice')


@router.get('/invoices/{invoice_id}/pdf')
async def invoice_pdf(invoice_id: str):
    inv = await run_in_threadpool(repository.get_invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail='Invoice not found')

    pdf_bytes = await run_in_threadpool(pdf_module.invoice_to_pdf_bytes, inv)
    if pdf_bytes:
        return Response(content=pdf_bytes, media_type='application/pdf')

    # Fallback: return HTML rendering
    html = await run_in_threadpool(pdf_module.render_invoice_html, inv)
    return HTMLResponse(content=html)
