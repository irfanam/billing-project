from decimal import Decimal
import asyncio

from backend.app.routes import create_invoice
from backend.app import repository as repo
from backend.app.schemas import InvoiceCreate, InvoiceItem


def test_create_invoice_resolves_product_tax_and_creates_invoice(monkeypatch):
    # prepare payload: one item without tax_percent, product provides tax_percent
    items = [
        InvoiceItem(product_id='p1', description='Product 1', qty=2, unit_price=Decimal('100.00'), tax_percent=None),
        InvoiceItem(product_id='p2', description='Product 2', qty=1, unit_price=Decimal('50.00'), tax_percent=Decimal('12')),
    ]
    payload = InvoiceCreate(customer_id='c1', items=items, issued_by='tester')

    # mocks
    def fake_get_product(pid):
        if pid == 'p1':
            return {'id': pid, 'tax_percent': Decimal('18')}
        return {'id': pid, 'tax_percent': Decimal('0')}

    def fake_get_customer(cid):
        return {'id': cid, 'state': 'Karnataka'}

    created_called = {}

    def fake_create_invoice(record):
        # capture the record passed in
        created_called['record'] = record
        # return a created invoice dict
        result = {'id': 'inv1', 'invoice_number': record['invoice_number']}
        result.update(record)
        return result

    def fake_insert_invoice_items(invoice_id, items_list):
        created_called['items'] = items_list
        return True

    def fake_decrement_stock(pid, qty):
        # record calls
        created_called.setdefault('decrements', []).append((pid, qty))
        return True

    monkeypatch.setattr(repo, 'get_product', fake_get_product)
    monkeypatch.setattr(repo, 'get_customer', fake_get_customer)
    monkeypatch.setattr(repo, 'create_invoice', fake_create_invoice)
    monkeypatch.setattr(repo, 'insert_invoice_items', fake_insert_invoice_items)
    monkeypatch.setattr(repo, 'decrement_product_stock', fake_decrement_stock)

    # run the route coroutine
    res = asyncio.run(create_invoice(payload))

    assert res['status'] == 'success'
    created = res['data']
    assert created['id'] == 'inv1'

    # verify invoice record values (tax calc)
    rec = created_called['record']
    assert rec['subtotal'] == Decimal('250.00')
    assert rec['cgst_amount'] == Decimal('21.00')
    assert rec['sgst_amount'] == Decimal('21.00')
    assert rec['igst_amount'] == Decimal('0.00')
    assert rec['total_tax'] == Decimal('42.00')
    assert rec['total_amount'] == Decimal('292.00')

    # verify items were inserted
    assert len(created_called['items']) == 2
    # verify stock decrements called
    assert ('p1', 2) in created_called['decrements']
    assert ('p2', 1) in created_called['decrements']


def test_invoice_with_inter_state_uses_igst(monkeypatch):
    items = [InvoiceItem(product_id='p3', description='P3', qty=3, unit_price=Decimal('99.99'), tax_percent=Decimal('18'))]
    payload = InvoiceCreate(customer_id='c2', items=items)

    def fake_get_product(pid):
        return {'id': pid, 'tax_percent': Decimal('18')}

    def fake_get_customer(cid):
        return {'id': cid, 'state': 'Maharashtra'}

    def fake_create_invoice(record):
        return {'id': 'inv2', 'invoice_number': record['invoice_number'], **record}

    monkeypatch.setattr(repo, 'get_product', fake_get_product)
    monkeypatch.setattr(repo, 'get_customer', fake_get_customer)
    monkeypatch.setattr(repo, 'create_invoice', fake_create_invoice)
    monkeypatch.setattr(repo, 'insert_invoice_items', lambda a,b: True)
    monkeypatch.setattr(repo, 'decrement_product_stock', lambda a,b: True)

    res = asyncio.run(create_invoice(payload))
    assert res['status'] == 'success'
    created = res['data']
    # subtotal = 3 * 99.99 = 299.97
    assert created['subtotal'] == Decimal('299.97')
    assert created['cgst_amount'] == Decimal('0.00')
    assert created['sgst_amount'] == Decimal('0.00')
    # igst should be rounded to 53.99 per tax module tests
    assert created['igst_amount'] == Decimal('53.99')
    assert created['total_amount'] == Decimal('353.96')
