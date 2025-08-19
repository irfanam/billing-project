from decimal import Decimal
import asyncio
import pytest
from pydantic import ValidationError

from backend.app.schemas import InvoiceItem, InvoiceCreate
from backend.app.routes import create_invoice
from backend.app import repository as repo


def test_invoice_item_qty_validation():
    # qty must be > 0
    with pytest.raises(ValidationError):
        InvoiceItem(product_id='p1', description='bad', qty=0, unit_price=Decimal('10.00'))


def test_missing_customer_uses_supplier_state_and_igst(monkeypatch):
    # Product has tax 18%, but customer lookup returns None -> inter-state assumed -> IGST
    items = [InvoiceItem(product_id='p1', description='P1', qty=1, unit_price=Decimal('100.00'), tax_percent=Decimal('18'))]
    payload = InvoiceCreate(customer_id='missing-customer', items=items)

    def fake_get_product(pid):
        return {'id': pid, 'tax_percent': Decimal('18')}

    def fake_get_customer(cid):
        return None

    def fake_create_invoice(record):
        return {'id': 'inv-missing-cust', **record}

    monkeypatch.setattr(repo, 'get_product', fake_get_product)
    monkeypatch.setattr(repo, 'get_customer', fake_get_customer)
    monkeypatch.setattr(repo, 'create_invoice', fake_create_invoice)
    monkeypatch.setattr(repo, 'insert_invoice_items', lambda a,b: True)
    # decrement may be called but we'll allow it to return False
    monkeypatch.setattr(repo, 'decrement_product_stock', lambda a,b: False)

    res = asyncio.run(create_invoice(payload))
    assert res['status'] == 'success'
    created = res['data']
    # subtotal 100.00, IGST 18% -> 18.00
    assert created['subtotal'] == Decimal('100.00')
    assert created['igst_amount'] == Decimal('18.00')
    assert created['cgst_amount'] == Decimal('0.00')
    assert created['sgst_amount'] == Decimal('0.00')


def test_decrement_stock_failure_does_not_block_invoice(monkeypatch):
    items = [InvoiceItem(product_id='p1', description='P1', qty=2, unit_price=Decimal('25.00'), tax_percent=Decimal('12'))]
    payload = InvoiceCreate(customer_id='c1', items=items)

    monkeypatch.setattr(repo, 'get_product', lambda pid: {'id': pid, 'tax_percent': Decimal('12')})
    monkeypatch.setattr(repo, 'get_customer', lambda cid: {'id': cid, 'state': 'Karnataka'})
    monkeypatch.setattr(repo, 'create_invoice', lambda record: {'id': 'inv-decr', **record})
    monkeypatch.setattr(repo, 'insert_invoice_items', lambda a,b: True)

    # simulate decrement failure
    monkeypatch.setattr(repo, 'decrement_product_stock', lambda a,b: False)

    res = asyncio.run(create_invoice(payload))
    assert res['status'] == 'success'
    created = res['data']
    # invoice created despite decrement failure
    assert created['id'] == 'inv-decr'
    assert created['subtotal'] == Decimal('50.00')
