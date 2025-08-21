import React from 'react';

export default function InvoiceForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="block font-semibold">Customer</label>
        <input type="text" className="border rounded px-2 py-1 w-full" placeholder="Customer name or ID" />
      </div>
      <div>
        <label className="block font-semibold">Products</label>
        <input type="text" className="border rounded px-2 py-1 w-full" placeholder="Product(s)" />
      </div>
      <div>
        <label className="block font-semibold">Quantity</label>
        <input type="number" className="border rounded px-2 py-1 w-full" placeholder="Quantity" />
      </div>
      <div>
        <label className="block font-semibold">GST (%)</label>
        <input type="number" className="border rounded px-2 py-1 w-full" placeholder="GST" />
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Create Invoice</button>
    </form>
  );
}
