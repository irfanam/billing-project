import React, { useState, useEffect } from 'react';

import axios from 'axios';
import { useSettings } from '../context/SettingsContext';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function Invoices() {
  const { formatCurrency } = useSettings();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    setError(null);
  axios.get(`${API_BASE_URL}/billing/invoices`)
      .then(res => {
        setInvoices(res.data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch invoices');
        setLoading(false);
      });
  }, []);

  // Filter and search logic
  const filtered = invoices.filter(inv =>
    (inv.customer_name?.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase())) &&
    (status ? inv.status === status : true)
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Invoices</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by customer or invoice ID"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1"
        />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1"
        >
          <option value="">All Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Overdue">Overdue</option>
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded shadow ml-auto">Create Invoice</button>
      </div>
      <div className="bg-white shadow rounded p-4 overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading invoices...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 text-left">Invoice ID</th>
                <th className="px-2 py-1 text-left">Customer</th>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-500">No invoices found.</td>
                </tr>
              ) : (
                paginated.map(inv => (
                  <tr key={inv.id} className="border-b">
                    <td className="px-2 py-1">{inv.invoice_number || inv.id}</td>
                    <td className="px-2 py-1">{inv.customer_name || inv.customer_id}</td>
                    <td className="px-2 py-1">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}</td>
                    <td className="px-2 py-1 text-right">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-2 py-1">{inv.status || '-'}</td>
                    <td className="px-2 py-1 text-center">
                      <button className="text-blue-600 hover:underline mr-2">View</button>
                      <button className="text-green-600 hover:underline mr-2">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      {/* Pagination */}
      <div className="flex justify-center items-center mt-4 gap-2">
        <button
          className="px-2 py-1 border rounded"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button
          className="px-2 py-1 border rounded"
          disabled={page === totalPages || totalPages === 0}
          onClick={() => setPage(page + 1)}
        >Next</button>
      </div>
    </div>
  );
}
