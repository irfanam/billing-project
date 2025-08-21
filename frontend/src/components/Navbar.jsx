import React from 'react';

export default function Navbar() {
  return (
    <nav className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
      <div className="font-bold text-lg">Billing App</div>
      <div className="space-x-4">
        <a href="/" className="hover:underline">Dashboard</a>
        <a href="/invoices" className="hover:underline">Invoices</a>
        <a href="/customers" className="hover:underline">Customers</a>
        <a href="/products" className="hover:underline">Products</a>
        <a href="/reports" className="hover:underline">Reports</a>
      </div>
    </nav>
  );
}
