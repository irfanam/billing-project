// ...existing code...

import React, { useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import formatCurrency from '../utils/formatCurrency';
// import Chart from 'chart.js/auto'; // Uncomment if you add Chart.js

const API_BASE_URL = 'https://billing-project-s0ql.onrender.com';

export default function Dashboard() {
  const { theme } = useSettings();
  const [stats, setStats] = useState({ revenue: 0, invoices: 0, customers: 0, products: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    // Fetch stats and recent invoices from backend
    Promise.all([
      fetch(`${API_BASE_URL}/billing/stats`).then(r => r.json()),
      fetch(`${API_BASE_URL}/billing/invoices?limit=5`).then(r => r.json())
    ]).then(([statsData, invoicesData]) => {
      setStats(statsData);
      setRecentInvoices(invoicesData.data || []);
    });
  }, []);

  return (
    <div className={`p-6 min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50'}`}>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
  <StatsCard title="Revenue" value={formatCurrency(stats.revenue)} icon="💰" />
        <StatsCard title="Invoices" value={stats.invoices} icon="🧾" />
        <StatsCard title="Customers" value={stats.customers} icon="👥" />
        <StatsCard title="Products" value={stats.products} icon="📦" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`rounded-lg shadow p-6 ${theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Recent Invoices</h2>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-2">Invoice #</th>
                <th className="py-2">Customer</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-gray-400">No invoices found.</td></tr>
              ) : recentInvoices.map(inv => (
                <tr key={inv.id} className="border-t">
                  <td className="py-2">{inv.id}</td>
                  <td className="py-2">{inv.customer_name || inv.customer_id}</td>
                  <td className="py-2">{formatCurrency(inv.amount)}</td>
                  <td className="py-2">{new Date(inv.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`rounded-lg shadow p-6 ${theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Revenue Overview</h2>
          {/* Chart.js or Recharts chart can go here */}
          <div className="h-48 flex items-center justify-center text-gray-400">[Revenue chart placeholder]</div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="text-lg font-semibold mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
