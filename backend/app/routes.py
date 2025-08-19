from fastapi import APIRouter, HTTPException
from typing import TYPE_CHECKING
from starlette.concurrency import run_in_threadpool
from backend.app import repository
from backend.app import tax as tax_module
from backend.app.schemas import InvoiceCreate
import logging
import uuid
import os
from fastapi.responses import Response, HTMLResponse
from backend.app import pdf as pdf_module

if TYPE_CHECKING:
    # imported for type-checking only to avoid importing top-level `app` package during tests
    from app.models import BillingRecord


router = APIRouter(prefix="/billing", tags=["Billing"])


def _insert_billing(record_dict: dict):
    # import supabase lazily to avoid top-level dependency on the `app` package during tests
    from app.database import supabase
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

    # decrement stock (best-effort)
    for it in payload.items:
        if it.product_id:
            await run_in_threadpool(repository.decrement_product_stock, it.product_id, it.qty)

    return {"status": "success", "data": created}


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
