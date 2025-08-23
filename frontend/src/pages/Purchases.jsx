import React, { useEffect, useState } from 'react';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function EmptyState({children}){
  return <div className="text-gray-500 py-6 text-center">{children}</div>
}

export default function Purchases(){
  const [suppliers,setSuppliers] = useState([])
  const [products,setProducts] = useState([])
  const [purchases,setPurchases] = useState([])

  // modal/form state
  const [showModal,setShowModal] = useState(false)
  const [items,setItems] = useState([{product_id:'',qty:1,unit_cost:0}])
  const [supplierId,setSupplierId] = useState('')
  const [saving,setSaving] = useState(false)

  useEffect(()=>{
    axios.get(`${API_BASE_URL}/billing/suppliers`).then(r=>setSuppliers(r.data.data||[])).catch(()=>setSuppliers([]))
    axios.get(`${API_BASE_URL}/billing/products`).then(r=>setProducts(r.data.data||[])).catch(()=>setProducts([]))
    // attempt to fetch purchases list; backend may or may not expose this route — handle gracefully
    axios.get(`${API_BASE_URL}/billing/purchases`).then(r=>setPurchases(r.data.data||[])).catch(()=>setPurchases([]))
  },[])

  const resetForm = ()=>{
    setItems([{product_id:'',qty:1,unit_cost:0}])
    setSupplierId('')
  }

  const save = async ()=>{
    // basic validation
    if(!items || items.length===0) return alert('Add at least one line')
    for(const it of items){
      if(!it.product_id) return alert('Select product for all lines')
      if(!it.qty || it.qty <= 0) return alert('Quantity must be > 0')
    }
    setSaving(true)
    try{
      const payload = {supplier_id: supplierId || null, items}
      await axios.post(`${API_BASE_URL}/billing/purchases`, payload)
      // optimistic: append a simple purchase summary to list
      const summary = { id: Date.now().toString(), supplier_id: supplierId, supplier_name: suppliers.find(s=>s.id===supplierId)?.name || null, items: items.map(i=>({product_id: i.product_id, qty: i.qty})), created_at: new Date().toISOString() }
      setPurchases([summary, ...purchases])
      resetForm()
      setShowModal(false)
    }catch(err){
      console.error('Failed to record purchase', err)
      alert('Failed to record purchase')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Purchases</h1>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={()=>{ resetForm(); setShowModal(true);}}>New Purchase</button>
        </div>
      </div>

      {/* purchases list */}
      <div className="mb-6 bg-white shadow rounded">
        {purchases.length===0 ? (
          <EmptyState>No purchases found yet.</EmptyState>
        ) : (
          <table className="w-full table-auto text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Lines</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p=> (
                <tr key={p.id} className="border-t">
                  <td className="p-3 align-top">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="p-3 align-top">{p.supplier_name || p.supplier_id || '—'}</td>
                  <td className="p-3 align-top">{(p.items||[]).length}</td>
                  <td className="p-3 align-top">{p.items && p.items.length>0 ? <button className="btn">View</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-6">
          <div className="bg-white rounded shadow-lg w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">New Purchase</h2>
              <button className="btn" onClick={()=>setShowModal(false)}>Close</button>
            </div>

            <div className="mb-4">
              <label className="block font-semibold">Supplier</label>
              <select value={supplierId} onChange={e=>setSupplierId(e.target.value)} className="input w-full">
                <option value="">-- select supplier (optional) --</option>
                {suppliers.map(s=> <option key={s.id} value={s.id}>{s.supplier_code || s.id} — {s.name}</option>)}
              </select>
            </div>

            <div className="mb-4">
              {items.map((it,idx)=> (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2">
                  <div className="col-span-6">
                    <select value={it.product_id} onChange={e=>{ const p = [...items]; p[idx].product_id = e.target.value; setItems(p)}} className="input w-full">
                      <option value="">-- select product --</option>
                      {products.map(p=> <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={it.qty} onChange={e=>{ const p=[...items]; p[idx].qty = parseInt(e.target.value||0); setItems(p)}} className="input w-full" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" value={it.unit_cost} onChange={e=>{ const p=[...items]; p[idx].unit_cost = parseFloat(e.target.value||0); setItems(p)}} className="input w-full" />
                  </div>
                  <div className="col-span-1">
                    <div className="flex gap-2">
                      <button className="btn" onClick={()=>{ const p=[...items]; p.splice(idx,1); setItems(p)}}>×</button>
                    </div>
                  </div>
                </div>
              ))}
              <div>
                <button className="btn" onClick={()=>setItems([...items,{product_id:'',qty:1,unit_cost:0}])}>Add line</button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn" onClick={()=>{ resetForm(); setShowModal(false); }}>Cancel</button>
              <button className="btn bg-blue-600 text-white" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Record Purchase'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
