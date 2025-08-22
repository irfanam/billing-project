import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function Suppliers(){
  const [suppliers,setSuppliers] = useState([])
  const [loading,setLoading] = useState(true)
  const [showForm,setShowForm] = useState(false)
  const [form,setForm] = useState({name:'',contact:'',address:'',phone:'',email:''})
  const navigate = useNavigate()

  useEffect(()=>{
    setLoading(true)
    axios.get(`${API_BASE_URL}/billing/suppliers`).then(r=>{setSuppliers(r.data.data||[]);setLoading(false)}).catch(()=>{setLoading(false)})
  },[])

  const save = async ()=>{
    try{
      const res = await axios.post(`${API_BASE_URL}/billing/suppliers`, form)
      setSuppliers([res.data.data,...suppliers])
      setShowForm(false)
      setForm({name:'',contact:'',address:'',phone:'',email:''})
    }catch(err){alert('Failed to save supplier')}
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Suppliers</h1>
      <div className="flex gap-2 mb-4">
        <button className="btn bg-blue-600 text-white" onClick={()=>setShowForm(true)}>Add Supplier</button>
      </div>
      {showForm && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="input" />
            <input placeholder="Contact" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} className="input" />
            <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="input" />
            <input placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="input" />
            <input placeholder="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="input col-span-2" />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button className="btn" onClick={()=>setShowForm(false)}>Cancel</button>
            <button className="btn bg-blue-600 text-white" onClick={save}>Save</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow p-4">
        {loading ? <div>Loading...</div> : (
          <table className="min-w-full">
            <thead><tr className="bg-gray-100"><th>Supplier ID</th><th>Name</th><th>Contact</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {suppliers.map(s=> (
                <tr key={s.id} className="border-b">
                  <td className="px-2 py-1">{s.supplier_code || s.id}</td>
                  <td className="px-2 py-1">{s.name}</td>
                  <td className="px-2 py-1">{s.contact}</td>
                  <td className="px-2 py-1">{s.email}</td>
                  <td className="px-2 py-1 text-right"><button className="text-blue-600" onClick={()=>navigate('/suppliers/'+s.id,{state:{supplier:s}})}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
