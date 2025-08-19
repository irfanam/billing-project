from typing import Optional, Dict
import os
import logging
from decimal import Decimal

# Try to import Jinja2 optionally; fall back to a simple renderer when unavailable
try:
    from jinja2 import Environment, FileSystemLoader, select_autoescape
    TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates')
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(['html', 'xml'])
    )
    _HAS_JINJA = True
except Exception:
    env = None
    _HAS_JINJA = False


def render_invoice_html(invoice: Dict) -> str:
    # ensure Decimal objects are converted to strings for safe rendering
    def dec(val):
        if isinstance(val, Decimal):
            return f"{val:.2f}"
        return val

    items = invoice.get('items') or []
    for it in items:
        it['unit_price'] = dec(it.get('unit_price'))
        it['line_total'] = dec(Decimal(it.get('line_total'))) if it.get('line_total') is not None else None

    if _HAS_JINJA and env is not None:
        tpl = env.get_template('invoice.html')
        ctx = {
            'invoice': invoice,
            'items': items,
            'customer': invoice.get('customer')
        }
        return tpl.render(**ctx)

    # Fallback simple HTML renderer
    rows = []
    for idx, it in enumerate(items, start=1):
        rows.append(f"<tr><td>{idx}</td><td>{it.get('description') or ''}</td><td style='text-align:right'>{it.get('qty')}</td><td style='text-align:right'>{it.get('unit_price')}</td><td style='text-align:right'>{it.get('line_total')}</td></tr>")

    html = f"""
    <html><body>
    <h2>Invoice {invoice.get('invoice_number')}</h2>
    <table border='1' style='border-collapse:collapse'>
    <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Line Total</th></tr></thead>
    <tbody>{''.join(rows)}</tbody></table>
    <div style='text-align:right'>Subtotal: {dec(invoice.get('subtotal'))}</div>
    <div style='text-align:right'>Total: {dec(invoice.get('total_amount'))}</div>
    </body></html>
    """
    return html


def invoice_to_pdf_bytes(invoice: Dict) -> Optional[bytes]:
    html = render_invoice_html(invoice)
    try:
        from weasyprint import HTML
        pdf = HTML(string=html).write_pdf()
        return pdf
    except Exception as exc:
        logging.warning('WeasyPrint not available or failed: %s', exc)
        return None
