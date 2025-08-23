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
  const [form, setForm] = useState({ name: '', phone: '', email: '', address1: '', address2: '', state: 'West Bengal', pincode: '', country: 'India', gstin: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

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
          onClick={() => { setShowForm(true); setEditingId(null); setReadOnly(false); setForm({ name: '', phone: '', email: '', address1: '', address2: '', state: 'West Bengal', pincode: '', country: 'India', gstin: '' }); }}
        >Add Customer</button>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <form className="bg-white rounded shadow p-6 w-full max-w-lg" onSubmit={async (e) => {
            e.preventDefault();
            if(readOnly){ setShowForm(false); return }
            // build payload for backend
            const payload = {
              name: form.name,
              phone: form.phone || undefined,
              email: form.email || undefined,
              state: form.state || undefined,
              gstin: form.gstin || undefined,
              // combine address lines and pincode into single address string
              address: [form.address1, form.address2].filter(Boolean).join('\n') + (form.pincode ? `\nPincode: ${form.pincode}` : ''),
            }
              try{
              if(editingId){
                const res = await axios.put(`${API_BASE_URL}/billing/customers/${editingId}`, payload)
                const updated = res.data.data
                setCustomers(customers.map(c => c.id === updated.id ? updated : c))
              } else {
                const res = await axios.post(`${API_BASE_URL}/billing/customers`, payload)
                const newCust = res.data.data
                setCustomers([newCust, ...customers])
              }
              setShowForm(false)
              setForm({ name: '', phone: '', email: '', address1: '', address2: '', state: 'West Bengal', pincode: '', country: 'India', gstin: '' })
              setEditingId(null)
            }catch(err){
              // surface server error if available
              let msg = 'Failed to save customer'
              try{ if(err.response && err.response.data && err.response.data.detail) msg = err.response.data.detail }catch(e){}
              alert(msg)
            }
          }}>
            <h2 className="text-xl font-bold mb-4">{readOnly ? 'View Customer' : (editingId ? 'Edit Customer' : 'Add Customer')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold">Name</label>
                <input required disabled={readOnly} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="block font-semibold">Mobile Number</label>
                <input required disabled={readOnly} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="block font-semibold">Email</label>
                <input type="email" disabled={readOnly} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="block font-semibold">State</label>
                <select disabled={readOnly} value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))} className="input">
                  <option value="">-- Select state --</option>
                  {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Puducherry','Chandigarh','Lakshadweep','Andaman and Nicobar Islands'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold">Pincode</label>
                <input disabled={readOnly} value={form.pincode} onChange={e=>setForm(f=>({...f,pincode:e.target.value}))} className="input" />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold">Address Line 1</label>
                <input disabled={readOnly} value={form.address1} onChange={e=>setForm(f=>({...f,address1:e.target.value}))} className="input" />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold">Address Line 2</label>
                <input disabled={readOnly} value={form.address2} onChange={e=>setForm(f=>({...f,address2:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="block font-semibold">Country</label>
                <input disabled value={form.country} className="input bg-gray-100" />
              </div>
              <div>
                <label className="block font-semibold">GSTIN (optional)</label>
                <input disabled={readOnly} value={form.gstin} onChange={e=>setForm(f=>({...f,gstin:e.target.value}))} className="input" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="px-3 py-1 border rounded" onClick={()=>{ setShowForm(false); setReadOnly(false); setEditingId(null); setForm({ name: '', phone: '', email: '', address1: '', address2: '', state: 'West Bengal', pincode: '', country: 'India', gstin: '' }) }}>Cancel</button>
              {!readOnly && <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>}
            </div>
          </form>
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
                        className="px-2 py-1 bg-gray-200 text-gray-800 rounded mr-2"
                        onClick={() => {
                          // Prefill form and open modal in read-only mode
                          let addr1 = ''
                          let addr2 = ''
                          let pincode = ''
                          if(cust.address){
                            const parts = cust.address.split('\n').map(s=>s.trim()).filter(Boolean)
                            const nonPinParts = []
                            for(const p of parts){
                              const m = p.match(/^Pincode:\s*(\d{3,6})$/i)
                              if(m){ pincode = m[1]; continue }
                              nonPinParts.push(p)
                            }
                            if(nonPinParts.length>0) addr1 = nonPinParts[0]
                            if(nonPinParts.length>1) addr2 = nonPinParts[1]
                          }
                          setForm({ name: cust.name || '', phone: cust.phone || '', email: cust.email || '', address1: addr1, address2: addr2, state: cust.state || 'West Bengal', pincode: pincode, country: 'India', gstin: cust.gstin || '' });
                          setEditingId(cust.id || null);
                          setReadOnly(true);
                          setShowForm(true);
                        }}
                      >View</button>
                      <button
                        className="px-2 py-1 bg-green-100 text-green-800 rounded mr-2"
                        onClick={() => {
                          // try to split existing address into lines and pincode
                          let addr1 = ''
                          let addr2 = ''
                          let pincode = ''
                          if(cust.address){
                            const parts = cust.address.split('\n').map(s=>s.trim()).filter(Boolean)
                            const nonPinParts = []
                            for(const p of parts){
                              const m = p.match(/^Pincode:\s*(\d{3,6})$/i)
                              if(m){ pincode = m[1]; continue }
                              nonPinParts.push(p)
                            }
                            if(nonPinParts.length>0) addr1 = nonPinParts[0]
                            if(nonPinParts.length>1) addr2 = nonPinParts[1]
                          }
                          setForm({ name: cust.name || '', phone: cust.phone || '', email: cust.email || '', address1: addr1, address2: addr2, state: cust.state || '', pincode: pincode, country: 'India', gstin: cust.gstin || '' });
                          setEditingId(cust.id || null);
                          setReadOnly(false);
                          setShowForm(true);
                        }}
                      >Edit</button>
                      <button
                        className="px-2 py-1 bg-red-100 text-red-800 rounded"
                        onClick={() => {
                          // open in-app confirmation modal
                          setDeleteTarget(cust)
                          setShowDeleteConfirm(true)
                        }}
                      >Delete</button>
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
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-3">Confirm delete</h3>
            <p className="mb-4">Are you sure you want to delete <strong>{deleteTarget.name || deleteTarget.id}</strong>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={()=>{ setShowDeleteConfirm(false); setDeleteTarget(null) }}>Cancel</button>
              <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={async ()=>{
                try{
                  await axios.delete(`${API_BASE_URL}/billing/customers/${deleteTarget.id}`)
                  setCustomers(customers.filter(c => c.id !== deleteTarget.id))
                }catch(err){
                  let msg = 'Failed to delete customer'
                  try{ if(err.response && err.response.data && err.response.data.detail) msg = err.response.data.detail }catch(e){}
                  alert(msg)
                } finally {
                  setShowDeleteConfirm(false); setDeleteTarget(null)
                }
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
