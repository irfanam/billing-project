from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal



class ProductCreate(BaseModel):
    sku: Optional[str]
    name: str
    description: Optional[str] = None
    price: Decimal
    tax_percent: Optional[Decimal] = Decimal('0.00')
    stock_qty: int = 0
    # New top-level product variables (migrated from `meta` JSONB)
    company: Optional[str] = None
    variant: Optional[str] = None
    type: Optional[str] = None
    selling_price: Optional[Decimal] = None
    p_code: Optional[str] = None

class Product(ProductCreate):
    id: str


class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    tax_percent: Optional[Decimal] = None
    stock_qty: Optional[int] = None
    company: Optional[str] = None
    variant: Optional[str] = None
    type: Optional[str] = None
    selling_price: Optional[Decimal] = None
    p_code: Optional[str] = None


class Customer(BaseModel):
    id: Optional[str]
    name: str
    gstin: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class InvoiceItem(BaseModel):
    product_id: Optional[str]
    description: Optional[str] = None
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
    created_at: Optional[str] = None


class Supplier(BaseModel):
    id: Optional[str]
    name: str
    contact: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class SupplierCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PurchaseItem(BaseModel):
    product_id: str
    qty: int = Field(..., gt=0)
    unit_cost: Decimal


class PurchaseCreate(BaseModel):
    supplier_id: Optional[str]
    items: List[PurchaseItem]
    received_by: Optional[str] = None


class SaleItem(BaseModel):
    product_id: str
    qty: int = Field(..., gt=0)
    unit_price: Decimal


class SaleCreate(BaseModel):
    customer_id: Optional[str]
    items: List[SaleItem]
    issued_by: Optional[str] = None
