from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from decimal import Decimal

class Product(BaseModel):
    id: Optional[str]
    sku: Optional[str]
    name: str
    description: Optional[str] = None
    price: Decimal
    tax_percent: Optional[Decimal] = Decimal('0.00')
    stock_qty: int = 0

class Customer(BaseModel):
    id: Optional[str]
    name: str
    gstin: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class InvoiceItem(BaseModel):
    product_id: Optional[str]
    description: Optional[str]
    qty: int = Field(..., gt=0)
    unit_price: Decimal
    tax_percent: Optional[Decimal] = None

class InvoiceCreate(BaseModel):
    customer_id: str
    items: List[InvoiceItem]
    issued_by: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    customer_id: str
    subtotal: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    from pydantic import BaseModel, Field
    from typing import List, Optional, Dict
    from decimal import Decimal


    class Product(BaseModel):
        id: Optional[str]
        sku: Optional[str]
        name: str
        description: Optional[str] = None
        price: Decimal
        tax_percent: Optional[Decimal] = Decimal('0.00')
        stock_qty: int = 0


    class Customer(BaseModel):
        id: Optional[str]
        name: str
        gstin: Optional[str] = None
        state: Optional[str] = None
        address: Optional[str] = None
        phone: Optional[str] = None
        email: Optional[str] = None


    class InvoiceItem(BaseModel):
        product_id: Optional[str]
        description: Optional[str]
        qty: int = Field(..., gt=0)
        unit_price: Decimal
        tax_percent: Optional[Decimal] = None


    class InvoiceCreate(BaseModel):
        customer_id: str
        items: List[InvoiceItem]
        issued_by: Optional[str] = None


    class InvoiceResponse(BaseModel):
        id: str
        invoice_number: str
        customer_id: str
        subtotal: Decimal
        cgst_amount: Decimal
        sgst_amount: Decimal
        igst_amount: Decimal
        total_tax: Decimal
        total_amount: Decimal
        currency: str = 'INR'
        created_at: Optional[str]
