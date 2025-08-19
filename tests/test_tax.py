from decimal import Decimal
from backend.app.tax import calculate_invoice_taxes


def test_intra_state_tax():
    supplier = 'Karnataka'
    customer = 'Karnataka'
    items = [
        {'qty': 2, 'unit_price': Decimal('100.00'), 'tax_percent': Decimal('18')},
        {'qty': 1, 'unit_price': Decimal('50.00'), 'tax_percent': Decimal('12')},
    ]
    res = calculate_invoice_taxes(supplier, customer, items)
    assert res['subtotal'] == Decimal('250.00')
    # tax for first line: 200 * 18% = 36 -> split 18/18
    # tax for second line: 50 * 12% = 6 -> split 3/3
    assert res['cgst'] == Decimal('21.00')
    assert res['sgst'] == Decimal('21.00')
    assert res['igst'] == Decimal('0.00')
    assert res['total_tax'] == Decimal('42.00')
    assert res['total'] == Decimal('292.00')


def test_inter_state_tax():
    supplier = 'Karnataka'
    customer = 'Maharashtra'
    items = [
        {'qty': 3, 'unit_price': Decimal('99.99'), 'tax_percent': Decimal('18')},
    ]
    res = calculate_invoice_taxes(supplier, customer, items)
    assert res['subtotal'] == Decimal('299.97')
    # line tax: 299.97 * 18% = 53.9946 -> rounded 53.99
    assert res['cgst'] == Decimal('0.00')
    assert res['sgst'] == Decimal('0.00')
    assert res['igst'] == Decimal('53.99')
    assert res['total_tax'] == Decimal('53.99')
    assert res['total'] == Decimal('353.96')
 