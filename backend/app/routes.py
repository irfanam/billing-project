import os
import logging
import uuid
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request, Body
from typing import TYPE_CHECKING
from starlette.concurrency import run_in_threadpool
from . import repository
from . import tax as tax_module
from .schemas import InvoiceCreate, Product, ProductCreate, ProductUpdate, CustomerUpdate
from .schemas import SupplierCreate, PurchaseCreate, PurchaseItem, SaleCreate
from fastapi.responses import Response, HTMLResponse
from . import pdf as pdf_module

logging.info(f"Loaded routes.py from: {os.path.abspath(__file__)}")


if TYPE_CHECKING:
    from app.models import BillingRecord


router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get('/customers')
async def list_customers():
    from app.database import supabase
    res = supabase.table('customers').select('*').execute()
    logging.info(f"Fetched customers: {res.data}")
    if getattr(res, 'error', None):
        raise HTTPException(status_code=500, detail=str(res.error))
    return {"status": "success", "data": res.data}


@router.post('/customers')
async def create_customer(request: Request):
    try:
        body = await request.json()
        # basic validation: require name
        if not body.get('name'):
            raise HTTPException(status_code=400, detail='Missing customer name')
        # insert via repository
        created = await run_in_threadpool(repository.create_customer, body)
        if not created:
            raise HTTPException(status_code=500, detail='Failed to create customer')
        return {"status": "success", "data": created}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('create_customer route exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.put('/customers/{customer_id}')
async def update_customer(customer_id: str, changes: 'CustomerUpdate' = Body(...)):
    # allow partial updates
    rec = changes.dict(exclude_unset=True)
    if not rec:
        raise HTTPException(status_code=400, detail='No changes provided')
    updated = await run_in_threadpool(repository.update_customer, customer_id, rec)
    if not updated:
        raise HTTPException(status_code=500, detail='Failed to update customer')
    return {"status": "success", "data": updated}



@router.delete('/customers/{customer_id}')
async def remove_customer(customer_id: str):
    ok = await run_in_threadpool(repository.delete_customer, customer_id)
    if not ok:
        raise HTTPException(status_code=500, detail='Failed to delete customer')
    return {"status": "success"}


@router.get('/products')
async def list_products():
    res = await run_in_threadpool(repository.list_products)
    if res is None:
        raise HTTPException(status_code=500, detail='Failed to fetch products')
    return {"status": "success", "data": res}



@router.get('/suppliers')
async def list_suppliers():
    res = await run_in_threadpool(repository.list_suppliers)
    if res is None:
        raise HTTPException(status_code=500, detail='Failed to fetch suppliers')
    return {"status": "success", "data": res}


@router.post('/suppliers')
async def create_supplier(request: Request):
    try:
        body = await request.json()
        if not body.get('name'):
            raise HTTPException(status_code=400, detail='Missing supplier name')
        created = await run_in_threadpool(repository.create_supplier, body)
        if not created:
            raise HTTPException(status_code=500, detail='Failed to create supplier')
        return {"status": "success", "data": created}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('create_supplier route exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')



@router.get('/product-variables/{vtype}')
async def get_product_variables(vtype: str):
    res = await run_in_threadpool(repository.list_product_variables, vtype)
    if res is None:
        raise HTTPException(status_code=500, detail='Failed to fetch variables')
    # repository.list_product_variables now returns { vtype_enabled, rows }
    return {'status': 'success', 'data': res}


@router.post('/product-variables/{vtype}')
async def add_product_variable(vtype: str, request: Request):
    try:
        body = await request.json()
        value = body.get('value')
        if not value:
            raise HTTPException(status_code=400, detail='Missing value')
        created = await run_in_threadpool(repository.upsert_product_variable, vtype, value)
        if not created:
            raise HTTPException(status_code=500, detail='Failed to add variable')
        return {'status': 'success', 'data': created}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('add_product_variable exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.delete('/product-variables/{vtype}')
async def remove_product_variable(vtype: str, request: Request):
    try:
        body = await request.json()
        value = body.get('value')
        if not value:
            raise HTTPException(status_code=400, detail='Missing value')
        ok = await run_in_threadpool(repository.delete_product_variable, vtype, value)
        if not ok:
            raise HTTPException(status_code=500, detail='Failed to delete variable')
        return {'status': 'success'}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('remove_product_variable exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.post('/product-variables/{vtype}/toggle')
async def toggle_product_variable(vtype: str, request: Request):
    try:
        body = await request.json()
        value = body.get('value')
        enabled = body.get('enabled')
        if value is None or enabled is None:
            raise HTTPException(status_code=400, detail='Missing value or enabled')
        ok = await run_in_threadpool(repository.update_product_variable_enabled, vtype, value, bool(enabled))
        if not ok:
            raise HTTPException(status_code=500, detail='Failed to update variable')
        return {'status': 'success'}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('toggle_product_variable exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.get('/product-variable-types/{vtype}')
async def get_product_variable_type(vtype: str):
    try:
        # return whether the type is enabled
        res = await run_in_threadpool(repository.list_product_variables, vtype)
        if res is None:
            raise HTTPException(status_code=500, detail='Failed to fetch variable type')
        # res has vtype_enabled
        return {'status': 'success', 'data': {'vtype': vtype, 'enabled': bool(res.get('vtype_enabled', True))}}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('get_product_variable_type exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.post('/product-variable-types/{vtype}/toggle')
async def set_product_variable_type(vtype: str, request: Request):
    try:
        body = await request.json()
        enabled = body.get('enabled')
        if enabled is None:
            raise HTTPException(status_code=400, detail='Missing enabled')
        ok = await run_in_threadpool(repository.set_product_variable_type_enabled, vtype, bool(enabled))
        if not ok:
            raise HTTPException(status_code=500, detail='Failed to update variable type')
        return {'status': 'success'}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('set_product_variable_type exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.get('/product-variable-types')
async def list_product_variable_types():
    try:
        res = await run_in_threadpool(repository.list_product_variable_types_all)
        if res is None:
            raise HTTPException(status_code=500, detail='Failed to fetch variable types')
        return {'status': 'success', 'data': res}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('list_product_variable_types exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.post('/purchases')
async def create_purchase(payload: PurchaseCreate):
    # payload contains supplier_id and items
    created = await run_in_threadpool(repository.apply_purchase, payload.supplier_id, [it.dict() for it in payload.items], payload.received_by)
    if not created:
        raise HTTPException(status_code=500, detail='Failed to record purchase')
    return {"status": "success", "data": created}


@router.post('/sales')
async def create_sale(payload: SaleCreate):
    allow_oversale = os.getenv('ALLOW_OVERSALE', 'false').lower() in ('1', 'true', 'yes')
    created = await run_in_threadpool(repository.apply_sale, payload.customer_id, [it.dict() for it in payload.items], payload.issued_by, allow_oversale)
    if not created:
        raise HTTPException(status_code=409, detail='Insufficient stock or failed to record sale')
    return {"status": "success", "data": created}


@router.post('/products')
async def create_product(request: Request):
    try:
        body = await request.json()
        logging.info(f"Raw product POST body: {body}")
        product_data = ProductCreate(**body)
        rec = product_data.dict(exclude_unset=True)
        # delegate creation to repository so it can assign UID... ids
        created = await run_in_threadpool(repository.create_product, rec)
        if not created:
            raise HTTPException(status_code=500, detail='Failed to create product')
        return {"status": "success", "data": created}
    except Exception as exc:
        logging.exception('Product validation error: %s', exc)
        raise


@router.put('/products/{product_id}')
async def update_product(product_id: str, product: 'ProductUpdate' = Body(...)):
    # allow partial updates from the frontend
    rec = product.dict(exclude_unset=True)
    updated = await run_in_threadpool(repository.update_product, product_id, rec)
    if not updated:
        raise HTTPException(status_code=500, detail='Failed to update product')
    return {"status": "success", "data": updated}



@router.delete('/products/{product_id}')
async def remove_product(product_id: str):
    # repository.delete_product may perform hard delete or soft-delete/anonymize.
    # Return a result dict with a hint so frontend can show an appropriate toast.
    res = await run_in_threadpool(repository.delete_product, product_id)
    if res is None or res is False:
        raise HTTPException(status_code=500, detail='Failed to delete product')
    # repository.delete_product returns True on success; to indicate soft-delete we rely on repository to set an attribute
    # For simplicity, call repository.get_product to inspect archived/name marker
    prod = await run_in_threadpool(repository.get_product, product_id)
    if not prod:
        # Hard-deleted
        return {"status": "success", "deleted": "hard"}
    # If archived flag present or name marker, report soft-delete
    if prod.get('archived') is True or (isinstance(prod.get('name'), str) and prod.get('name').endswith(' [deleted]')):
        return {"status": "success", "deleted": "soft"}
    return {"status": "success", "deleted": "unknown"}


@router.get('/products/archived')
async def list_archived_products():
    # Return products that are archived or anonymized (name endswith ' [deleted]')
    try:
        res = await run_in_threadpool(repository.list_archived_products)
        if res is None:
            raise HTTPException(status_code=500, detail='Failed to fetch archived products')
        return {"status": "success", "data": res}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception('list_archived_products exception: %s', exc)
        raise HTTPException(status_code=500, detail='Internal error')


@router.post('/products/{product_id}/undelete')
async def undelete_product(product_id: str):
    # Attempt to restore an anonymized/archived product
    ok = await run_in_threadpool(repository.undelete_product, product_id)
    if not ok:
        raise HTTPException(status_code=500, detail='Failed to undelete product')
    return {"status": "success"}


# Legacy billing handlers removed. Use repository functions / new endpoints instead.


@router.post('/invoices/')
async def create_invoice(payload: InvoiceCreate):
    allow_oversale = os.getenv('ALLOW_OVERSALE', 'false').lower() in ('1', 'true', 'yes')
    # Validate customer_id early: reject invalid UUIDs with a clear 400 response.
    if payload.customer_id:
        try:
            # ensure it's a valid UUID string
            uuid.UUID(str(payload.customer_id))
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid customer_id: must be a UUID')
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
                    # insufficient stock or error - try best-effort oversell by decrementing stock allowing negative
                    logging.info('Failed to reserve stock for product %s qty %s; attempting best-effort oversell', it.product_id, it.qty)
                    try:
                        decremented = await run_in_threadpool(repository.decrement_product_stock, it.product_id, it.qty, True)
                    except Exception:
                        decremented = False
                    if decremented:
                        logging.info('Oversold product %s qty %s (stock went negative) to allow invoicing', it.product_id, it.qty)
                        # continue without a reservation record
                        res = 'SKIPPED_OVERSALE'
                    else:
                        # release any previous reservations and abort
                        raise HTTPException(status_code=409, detail=f'Insufficient stock for product {it.product_id}')
                # only append real reservation records (dicts) returned by DB
                if isinstance(res, dict):
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
                        await run_in_threadpool(repository.decrement_product_stock, it.product_id, it.qty, allow_oversale)
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


@router.get('/invoices')
async def list_invoices(limit: int = 0):
    """Return invoices list. Frontend calls this endpoint without auth in dev."""
    if limit and limit > 0:
        res = await run_in_threadpool(repository.list_invoices, limit)
    else:
        res = await run_in_threadpool(repository.list_invoices, None)
    if res is None:
        raise HTTPException(status_code=500, detail='Failed to fetch invoices')
    return {"status": "success", "data": res}


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
