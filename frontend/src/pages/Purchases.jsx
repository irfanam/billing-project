import React, { useEffect, useState } from 'react';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function Purchases(){
  const [suppliers,setSuppliers] = useState([])
  const [products,setProducts] = useState([])
  const [items,setItems] = useState([{product_id:'',qty:1,unit_cost:0}])
  const [supplierId,setSupplierId] = useState('')

  useEffect(()=>{
    axios.get(`${API_BASE_URL}/billing/suppliers`).then(r=>setSuppliers(r.data.data||[])).catch(()=>{})
    axios.get(`${API_BASE_URL}/billing/products`).then(r=>setProducts(r.data.data||[])).catch(()=>{})
  },[])

  const save = async ()=>{
    try{
      const payload = {supplier_id: supplierId || null, items}
      await axios.post(`${API_BASE_URL}/billing/purchases`, payload)
      alert('Purchase recorded')
      setItems([{product_id:'',qty:1,unit_cost:0}])
      setSupplierId('')
    }catch(err){alert('Failed to record purchase')}
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Purchase</h1>
      <div className="mb-4">
        <label className="block font-semibold">Supplier</label>
        <select value={supplierId} onChange={e=>setSupplierId(e.target.value)} className="input">
          <option value="">-- select supplier --</option>
          {suppliers.map(s=> <option key={s.id} value={s.id}>{s.supplier_code || s.id} — {s.name}</option>)}
        </select>
      </div>
      {items.map((it,idx)=> (
        <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
          <select value={it.product_id} onChange={e=>{ const p = [...items]; p[idx].product_id = e.target.value; setItems(p)}} className="input">
            <option value="">-- select product --</option>
            {products.map(p=> <option key={p.id} value={p.id}>{p.product_code || p.id} — {p.name}</option>)}
          </select>
          <input type="number" value={it.qty} onChange={e=>{ const p=[...items]; p[idx].qty = parseInt(e.target.value||0); setItems(p)}} className="input" />
          <input type="number" value={it.unit_cost} onChange={e=>{ const p=[...items]; p[idx].unit_cost = parseFloat(e.target.value||0); setItems(p)}} className="input" />
          <div className="flex gap-2"><button className="btn" onClick={()=>{ const p=[...items]; p.splice(idx,1); setItems(p)}}>Remove</button></div>
        </div>
      ))}
      <div className="flex gap-2 mb-4">
        <button className="btn" onClick={()=>setItems([...items,{product_id:'',qty:1,unit_cost:0}])}>Add Line</button>
      </div>
      <div className="flex gap-2">
        <button className="btn bg-blue-600 text-white" onClick={save}>Record Purchase</button>
      </div>
    </div>
  )
}
