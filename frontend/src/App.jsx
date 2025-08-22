import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios'

const API_BASE_URL = 'https://billing-project-s0ql.onrender.com';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoiceCreate from './pages/InvoiceCreate';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import SupplierDetail from './pages/SupplierDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function BillingForm({ onAdded }) {
  const [user_id, setUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const payload = { user_id, amount: parseFloat(amount), description }
  await axios.post(`${API_BASE_URL}/billing/`, payload)
    setUserId('')
    setAmount('')
    setDescription('')
    onAdded && onAdded()
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input className="input" placeholder="User ID" value={user_id} onChange={e=>setUserId(e.target.value)} required />
      <input className="input" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} required type="number" step="0.01" />
      <input className="input" placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} required />
      <button className="btn" type="submit">Create</button>
    </form>
  );
}
function BillingList({ userId }) {
  const [items, setItems] = useState([])
  useEffect(()=>{
    if(!userId) return
  axios.get(`${API_BASE_URL}/billing/${userId}`).then(r=>setItems(r.data.data || []))
  },[userId])

  return (
    <div>
      {items.length===0 ? <p className="muted">No records</p> : (
        <ul className="space-y-2">
          {items.map((it, idx)=> (
            <li key={idx} className="card">{it.description} — ${it.amount}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useSettings } from './context/SettingsContext';

function App() {
  const { theme } = useSettings();
  return (
    <Router>
      <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : ''}`}>
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className={`flex-1 p-6 ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50'}`}> 
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/:id" element={<SupplierDetail />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
