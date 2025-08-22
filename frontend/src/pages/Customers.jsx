import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [editingId, setEditingId] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', state: '', gstin: '', email: '' });

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(`${API_BASE_URL}/billing/customers`)
      .then(res => {
        setCustomers(res.data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch customers');
        setLoading(false);
      });
  }, []);
  const navigate = useNavigate();

  // Filter and search logic
  const filtered = customers.filter(cust =>
    cust.name?.toLowerCase().includes(search.toLowerCase()) ||
    (cust.customer_code || cust.id || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Customers</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name or ID"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1"
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded shadow ml-auto"
          onClick={() => { setShowForm(true); setEditingId(null); setReadOnly(false); }}
        >Add Customer</button>
      </div>
      {showForm && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h2 className="text-lg font-semibold mb-2">{readOnly ? 'View Customer' : (editingId ? 'Edit Customer' : 'Add Customer')}</h2>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="border p-2" disabled={readOnly} />
            <input placeholder="State" value={form.state} onChange={e=>setForm({...form,state:e.target.value})} className="border p-2" disabled={readOnly} />
            <input placeholder="GSTIN" value={form.gstin} onChange={e=>setForm({...form,gstin:e.target.value})} className="border p-2" disabled={readOnly} />
            <input placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="border p-2" disabled={readOnly} />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button className="px-3 py-1 border rounded" onClick={()=>{ setShowForm(false); setReadOnly(false); setEditingId(null); setForm({name:'',state:'',gstin:'',email:''}); }}>Cancel</button>
            {!readOnly && (
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={async ()=>{
                try{
                  if(editingId){
                    const res = await axios.put(`${API_BASE_URL}/billing/customers/${editingId}`, form)
                    const updated = res.data.data
                    setCustomers(customers.map(c => c.id === updated.id ? updated : c))
                  } else {
                    const res = await axios.post(`${API_BASE_URL}/billing/customers`, form)
                    const newCust = res.data.data
                    setCustomers([newCust, ...customers])
                  }
                  setShowForm(false)
                  setForm({name:'',state:'',gstin:'',email:''})
                  setEditingId(null)
                }catch(err){
                  alert('Failed to save customer')
                }
              }}>Save</button>
            )}
          </div>
        </div>
      )}
      <div className="bg-white shadow rounded p-4 overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading customers...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 text-left">Customer ID</th>
                <th className="px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left">State</th>
                <th className="px-2 py-1 text-left">GSTIN</th>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-500">No customers found.</td>
                </tr>
              ) : (
                paginated.map(cust => (
                  <tr key={cust.id} className="border-b">
                    <td className="px-2 py-1">{cust.customer_code || cust.id}</td>
                    <td className="px-2 py-1">{cust.name}</td>
                    <td className="px-2 py-1">{cust.state}</td>
                    <td className="px-2 py-1">{cust.gstin}</td>
                    <td className="px-2 py-1">{cust.email}</td>
                    <td className="px-2 py-1 text-center">
                      <button
                        className="text-blue-600 hover:underline mr-2"
                        onClick={() => navigate(`/customers/${cust.id}`, { state: { customer: cust } })}
                      >View</button>
                      <button
                        className="text-green-600 hover:underline mr-2"
                        onClick={() => {
                          setForm({ name: cust.name || '', state: cust.state || '', gstin: cust.gstin || '', email: cust.email || '' });
                          setEditingId(cust.id || null);
                          setReadOnly(false);
                          setShowForm(true);
                        }}
                      >Edit</button>
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
