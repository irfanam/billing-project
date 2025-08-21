import React from 'react';

export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* StatsCard components here */}
        <div className="bg-white shadow rounded p-4">Total Sales</div>
        <div className="bg-white shadow rounded p-4">Invoices</div>
        <div className="bg-white shadow rounded p-4">Stock Alerts</div>
      </div>
      {/* Recent activity, charts, etc. */}
    </div>
  );
}
