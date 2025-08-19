from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import List, Dict

getcontext().prec = 28


def quantize_two(d: Decimal) -> Decimal:
    return d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def is_intra_state(supplier_state: str, customer_state: str) -> bool:
    if not supplier_state or not customer_state:
        return False
    return supplier_state.strip().lower() == customer_state.strip().lower()


def calculate_invoice_taxes(supplier_state: str, customer_state: str, items: List[Dict]) -> Dict:
    """
    items: list of { qty: int, unit_price: Decimal, tax_percent: Decimal }
    returns: { subtotal, cgst, sgst, igst, total_tax, total }
    """
    subtotal = Decimal('0')
    cgst = Decimal('0')
    sgst = Decimal('0')
    igst = Decimal('0')

    intra = is_intra_state(supplier_state, customer_state)

    for it in items:
        qty = Decimal(it['qty'])
        up = Decimal(it['unit_price'])
        taxp = Decimal(it.get('tax_percent') or 0)
        line_net = qty * up
        subtotal += line_net
        line_tax = (line_net * taxp) / Decimal(100)
        if intra:
            half = line_tax / 2
            cgst += quantize_two(half)
            sgst += quantize_two(half)
        else:
            igst += quantize_two(line_tax)

    subtotal = quantize_two(subtotal)
    total_tax = quantize_two(cgst + sgst + igst)
    total = quantize_two(subtotal + total_tax)

    return {
        'subtotal': subtotal,
        'cgst': cgst,
        'sgst': sgst,
        'igst': igst,
        'total_tax': total_tax,
        'total': total,
    }
