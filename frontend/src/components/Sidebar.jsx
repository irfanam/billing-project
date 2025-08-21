import React from 'react';

export default function Sidebar() {
  return (
    <aside className="bg-gray-100 w-64 min-h-screen p-4">
      <nav className="flex flex-col space-y-2">
        <a href="/" className="font-semibold">Dashboard</a>
        <a href="/invoices">Invoices</a>
        <a href="/customers">Customers</a>
        <a href="/products">Products</a>
        <a href="/reports">Reports</a>
      </nav>
    </aside>
  );
}
