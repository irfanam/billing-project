import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios'
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
import Reports from './pages/Reports';

function BillingForm({ onAdded }) {
  const [user_id, setUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const payload = { user_id, amount: parseFloat(amount), description }
    await axios.post('/api/billing/', payload)
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
  )
}

function BillingList({ userId }) {
  const [items, setItems] = useState([])
  useEffect(()=>{
    if(!userId) return
    axios.get(`/api/billing/${userId}`).then(r=>setItems(r.data.data || []))
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

export default function App(){
  const [selectedUser, setSelectedUser] = useState('')
  const [refresh, setRefresh] = useState(0)
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 bg-gray-50">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">Billing Dashboard</h1>
                <ThemeToggle />
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
                <BillingForm onAdded={()=>setRefresh(r=>r+1)} />
              </div>

              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded shadow">
                <label className="block mb-2">Enter User ID to view records</label>
                <input className="input mb-3" value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} />
                <BillingList userId={selectedUser} key={selectedUser+refresh} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </Router>
  )
}

function ThemeToggle(){
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  useEffect(()=>{
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  },[dark])
  return (
    <button className="btn" onClick={()=>setDark(d=>!d)}>{dark ? 'Light' : 'Dark'}</button>
  )
}
