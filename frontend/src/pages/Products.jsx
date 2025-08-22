import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function Products() {
  const [activeTab, setActiveTab] = useState('list')
  const [companies, setCompanies] = useState([])
  const [variants, setVariants] = useState([])
  const [gstRates, setGstRates] = useState([])

  // load settings from localStorage
  useEffect(()=>{
    try{
      const c = JSON.parse(localStorage.getItem('product_companies')||'[]')
      const v = JSON.parse(localStorage.getItem('product_variants')||'[]')
      const g = JSON.parse(localStorage.getItem('product_gst_rates')||'[]')
      setCompanies(c)
      setVariants(v)
      setGstRates(g)
    }catch(e){/* ignore */}
  },[])
  const [products, setProducts] = useState([]);
  const [supportsMeta, setSupportsMeta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const pageSize = 10;

  const fetchProducts = () => {
    setLoading(true);
    setError(null);
    axios.get(`${API_BASE_URL}/billing/products`)
      .then(res => {
        const data = res.data.data || [];
        setProducts(data);
        // detect if backend supports a `meta` JSON column on products
        if (data.length > 0 && data[0].meta && typeof data[0].meta === 'object') {
          setSupportsMeta(true)
        } else {
          setSupportsMeta(false)
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch products');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, []);
  const navigate = useNavigate();

  // Filter and search logic
  const [filterCompany, setFilterCompany] = useState('')
  const [filterVariant, setFilterVariant] = useState('')
  const [filterGst, setFilterGst] = useState('')

  const filtered = products.filter(prod =>
    prod.name?.toLowerCase().includes(search.toLowerCase()) ||
    prod.sku?.toLowerCase().includes(search.toLowerCase()) ||
    (prod.product_code || prod.id || '').toLowerCase().includes(search.toLowerCase())
  );
  // apply settings filters
  const filteredWithSettings = filtered.filter(p => {
    if (filterCompany && !(p.meta && p.meta.company === filterCompany)) return false
    if (filterVariant && !(p.meta && p.meta.variant === filterVariant)) return false
    if (filterGst && String(p.tax_percent) !== String(filterGst)) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filteredWithSettings.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${activeTab==='list'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setActiveTab('list')}>List</button>
        <button className={`px-3 py-1 rounded ${activeTab==='settings'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setActiveTab('settings')}>Settings</button>
      </div>
      {activeTab !== 'settings' && (
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, SKU, or ID"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1"
        />
        {/* settings filters */}
        {companies.length>0 && (
          <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)} className="border rounded px-2 py-1">
            <option value="">All Companies</option>
            {companies.map((c,idx)=> <option key={idx} value={c}>{c}</option>)}
          </select>
        )}
        {variants.length>0 && (
          <select value={filterVariant} onChange={e=>setFilterVariant(e.target.value)} className="border rounded px-2 py-1">
            <option value="">All Variants</option>
            {variants.map((v,idx)=> <option key={idx} value={v}>{v}</option>)}
          </select>
        )}
        {gstRates.length>0 && (
          <select value={filterGst} onChange={e=>setFilterGst(e.target.value)} className="border rounded px-2 py-1">
            <option value="">All GST</option>
            {gstRates.map((g,idx)=> <option key={idx} value={g}>{g}%</option>)}
          </select>
        )}
        <button className="bg-blue-600 text-white px-4 py-2 rounded shadow ml-auto" onClick={() => { setEditProduct(null); setShowForm(true); }}>Add Product</button>
      </div>
      )}
    {showForm && (
        <ProductForm
          product={editProduct}
      onClose={() => { setShowForm(false); setEditProduct(null); }}
      onSaved={() => { setShowForm(false); setEditProduct(null); fetchProducts(); }}
      companies={companies}
      variants={variants}
      gstRates={gstRates}
      supportsMeta={supportsMeta}
        />
      )}
    {activeTab === 'list' && (
    <div className="bg-white shadow rounded p-4 overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading products...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 text-left">Product ID</th>
                <th className="px-2 py-1 text-left">SKU</th>
                <th className="px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left">Variant</th>
                <th className="px-2 py-1 text-left">Amount</th>
                <th className="px-2 py-1 text-left">GST</th>
                <th className="px-2 py-1 text-left">Total Price</th>
                <th className="px-2 py-1 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-gray-500">No products found.</td>
                </tr>
              ) : (
                paginated.map(prod => (
                  <tr key={prod.id} className="border-b">
                    <td className="px-2 py-1">{prod.product_code || prod.id}</td>
                    <td className="px-2 py-1">{prod.sku}</td>
                    <td className="px-2 py-1">{(() => {
                      // Display name without any appended variant. If meta.company exists, prefix it.
                      let base = typeof prod.name === 'string' ? prod.name : ''
                      if (base.includes(' — ')) {
                        base = base.split(' — ')[0].trim()
                      }
                      if (prod.meta && prod.meta.company) {
                        return `${prod.meta.company} - ${base}`
                      }
                      return base
                    })()}</td>
                    <td className="px-2 py-1">{(() => {
                      // prefer structured meta
                      if (prod.meta && prod.meta.variant) return prod.meta.variant
                      // fallback: if name was stored as "... — Variant", parse trailing part
                      if (typeof prod.name === 'string' && prod.name.includes(' — ')) {
                        const parts = prod.name.split(' — ')
                        return parts[parts.length - 1].trim()
                      }
                      // older fallback: variant may be in description as '| Variant: X'
                      if (prod.description && prod.description.includes('| Variant:')) {
                        const m = prod.description.match(/\| Variant:\s*([^|]+)/)
                        if (m && m[1]) return m[1].trim()
                      }
                      return '—'
                    })()}</td>
                    <td className="px-2 py-1">${prod.price}</td>
                    <td className="px-2 py-1">{prod.tax_percent ? `${prod.tax_percent}%` : '—'}</td>
                    <td className="px-2 py-1">
                      ${(() => {
                        const price = Number(prod.price) || 0
                        const tax = Number(prod.tax_percent) || 0
                        const total = price + (price * (tax / 100))
                        return total.toFixed(2)
                      })()}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button className="text-blue-600 hover:underline mr-2" onClick={() => navigate(`/products/${prod.id}`, { state: { product: prod } })}>View</button>
                      <button className="text-green-600 hover:underline mr-2" onClick={() => { setEditProduct(prod); setShowForm(true); }}>Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white shadow rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Product Settings</h2>
            <p className="text-sm text-gray-600 mb-4">Manage variables that can be selected when adding a product.</p>
            <SimpleListEditor title="Companies" storageKey="product_companies" items={companies} setItems={setCompanies} placeholder="Add company" apiVtype="company" />
            <SimpleListEditor title="Variants (Size)" storageKey="product_variants" items={variants} setItems={setVariants} placeholder="Add variant (e.g. Small)" apiVtype="variant" />
            <SimpleListEditor title="GST Rates" storageKey="product_gst_rates" items={gstRates} setItems={setGstRates} placeholder="Add GST rate (e.g. 18)" numeric apiVtype="gst" />
          </div>
        )}
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

function ProductForm({ product, onClose, onSaved, companies = [], variants = [], gstRates = [], supportsMeta = false }) {
  const skuRef = React.useRef()
  React.useEffect(()=>{ if(skuRef.current) skuRef.current.focus() }, [])
  const [form, setForm] = useState(() => {
    // derive base name: remove company prefix "Company - " and trailing " — Variant"
    const rawName = product?.name || ''
    let baseName = rawName
    try {
      // remove any company prefix that matches an entry in the companies list
      if (Array.isArray(companies) && companies.length && typeof rawName === 'string') {
        for (const c of companies) {
          if (!c) continue
          const prefix = `${c} - `
          if (rawName.toLowerCase().startsWith(prefix.toLowerCase())) {
            baseName = rawName.slice(prefix.length)
            break
          }
        }
      } else if (product && product.meta && product.meta.company && typeof rawName === 'string') {
        const prefix = `${product.meta.company} - `
        if (rawName.startsWith(prefix)) baseName = rawName.slice(prefix.length)
      }
      if (typeof baseName === 'string' && baseName.includes(' — ')) {
        baseName = baseName.split(' — ')[0].trim()
      }
    } catch (e) { /* ignore and fallback to rawName */ }
    // compute total price if backend provided it or derive from price & tax
    let initPrice = product?.price !== undefined ? Number(product.price) : ''
    let initTax = product?.tax_percent !== undefined ? Number(product.tax_percent) : 0
    let initTotal = product?.total_price !== undefined ? Number(product.total_price) : (
      initPrice !== '' && !isNaN(initPrice) ? +(initPrice + (initPrice * (initTax / 100))).toFixed(2) : ''
    )
    return {
      sku: product?.sku || '',
      name: baseName || '',
      description: product?.description || '',
      // price is the amount before tax
      price: initPrice !== '' ? String(initPrice) : '',
      // total_price is amount including tax
      total_price: initTotal !== '' ? String(initTotal) : '',
      tax_percent: product?.tax_percent !== undefined ? String(product.tax_percent) : '',
      company: product?.meta?.company || (companies[0] || ''),
      variant: product?.meta?.variant || (variants[0] || ''),
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastEdited, setLastEdited] = useState('amount') // 'amount' or 'total'

  const handleChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  };

  const handleAmountChange = e => {
    const v = e.target.value
    setLastEdited('amount')
    // keep raw string for input but compute total
    setForm(f => {
      const price = v === '' ? '' : Number(v)
      const tax = Number(f.tax_percent) || 0
      let total = ''
      if (price !== '' && !isNaN(price)) {
        total = (price + (price * (tax / 100)))
        total = total === 0 ? '0.00' : total.toFixed(2)
      }
      return { ...f, price: v, total_price: total }
    })
  }

  const handleTotalChange = e => {
    const v = e.target.value
    setLastEdited('total')
    setForm(f => {
      const total = v === '' ? '' : Number(v)
      const tax = Number(f.tax_percent) || 0
      let price = ''
      if (total !== '' && !isNaN(total)) {
        // amount = total / (1 + tax/100)
        const denom = 1 + (tax / 100)
        if (denom !== 0) {
          price = (total / denom)
          price = price === 0 ? '0.00' : price.toFixed(2)
        }
      }
      return { ...f, total_price: v, price: price }
    })
  }

  const handleGstSelect = e => {
    const v = e.target.value
    // update tax and recalc other field based on last edited
    setForm(f => {
      const newTax = v === '' ? '' : v
      const taxNum = Number(newTax) || 0
      if (lastEdited === 'amount') {
        const p = f.price === '' ? '' : Number(f.price)
        let total = ''
        if (p !== '' && !isNaN(p)) total = (p + (p * (taxNum / 100))).toFixed(2)
        return { ...f, tax_percent: newTax, total_price: total }
      } else {
        const t = f.total_price === '' ? '' : Number(f.total_price)
        let price = ''
        if (t !== '' && !isNaN(t)) {
          const denom = 1 + (taxNum / 100)
          if (denom !== 0) price = (t / denom).toFixed(2)
        }
        return { ...f, tax_percent: newTax, price: price }
      }
    })
  }

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Ensure correct types for backend
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      price: form.price !== '' ? parseFloat(form.price) : undefined,
      tax_percent: form.tax_percent !== '' ? parseFloat(form.tax_percent) : undefined,
    };
    if (supportsMeta) {
      payload.meta = {
        company: form.company || undefined,
        variant: form.variant || undefined
      }
    } else {
      if (form.company || form.variant) {
        // when meta is not supported, prefix the product name with the company and append variant inline
        let prefix = ''
        if (form.company) prefix += `${form.company} - `
        let newName = `${prefix}${form.name}`.trim()
        if (form.variant) newName = `${newName} — ${form.variant}`
        payload.name = newName
      }
    }
    try {
      if (product && product.id) {
        // Edit
        await axios.put(`${API_BASE_URL}/billing/products/${product.id}`, payload);
      } else {
        // Add
        await axios.post(`${API_BASE_URL}/billing/products`, payload);
      }
      setSaving(false);
      // reset form for next use
  setForm({ sku: '', name: '', description: '', price: '', tax_percent: '', company: companies[0] || '', variant: variants[0] || '' })
      onSaved && onSaved();
    } catch (err) {
      setError('Failed to save product');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form className="bg-white rounded shadow p-6 w-full max-w-md" onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-4">{product ? 'Edit Product' : 'Add Product'}</h2>
        <div className="mb-2">
          <label className="block font-semibold">SKU</label>
          <input ref={skuRef} name="sku" value={form.sku} onChange={handleChange} className="input" required />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Name</label>
          <input name="name" value={form.name} onChange={handleChange} className="input" required />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Description</label>
          <input name="description" value={form.description} onChange={handleChange} className="input" />
        </div>
        {companies && companies.length>0 && (
          <div className="mb-2">
            <label className="block font-semibold">Company</label>
            <select name="company" value={form.company} onChange={handleChange} className="input">
              <option value="">-- select company --</option>
              {companies.map((c,idx)=> <option key={idx} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className="mb-2">
          <label className="block font-semibold">Variant</label>
          {variants && variants.length>0 ? (
            <select name="variant" value={form.variant} onChange={handleChange} className="input">
              <option value="">-- select variant --</option>
              {variants.map((v,idx)=> <option key={idx} value={v}>{v}</option>)}
            </select>
          ) : (
            <input name="variant" value={form.variant} onChange={handleChange} className="input" placeholder="Variant (optional)" />
          )}
        </div>
        <div className="mb-2">
          <label className="block font-semibold">GST</label>
          {gstRates && gstRates.length>0 ? (
            <select name="gst_select" value={form.tax_percent} onChange={handleGstSelect} className="input">
              <option value="">-- select GST % --</option>
              {gstRates.map((g,idx)=> <option key={idx} value={g}>{g}%</option>)}
            </select>
          ) : (
            <input name="tax_percent" value={form.tax_percent} onChange={handleChange} className="input" type="number" step="0.01" placeholder="GST %" />
          )}
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Amount (pre-tax)</label>
          <input name="price" value={form.price} onChange={handleAmountChange} className="input" type="number" step="0.01" required />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Total Price (including GST)</label>
          <input name="total_price" value={form.total_price} onChange={handleTotalChange} className="input" type="number" step="0.01" />
        </div>
  {/* Tax % and Stock Qty removed. GST is selected via GST Rate and stock is managed via purchases/sales. */}
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" className="btn bg-gray-400" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function SimpleListEditor({ title, storageKey, items, setItems, placeholder, numeric, apiVtype }){
  const [val, setVal] = useState('')
  const [loadingVars, setLoadingVars] = useState(false)

  // Try to load from API when apiVtype is provided. Fallback to localStorage is preserved.
  useEffect(()=>{
    if(!apiVtype) return;
    setLoadingVars(true)
    axios.get(`${API_BASE_URL}/billing/product-variables/${apiVtype}`)
      .then(res => {
        const data = (res.data && res.data.data) ? res.data.data : []
        // API returns array of values; update state and localStorage for offline fallback
        setItems(data)
        try{ localStorage.setItem(storageKey, JSON.stringify(data)) }catch(e){}
      })
      .catch(()=>{
        // ignore: we'll just use whatever is in localStorage / existing state
      })
      .finally(()=> setLoadingVars(false))
  }, [apiVtype])

  const save = async ()=>{
    if(!val) return
    if(numeric){
      // validate numeric
      const n = parseFloat(val)
      if(Number.isNaN(n)) return alert('Please enter a numeric value for this list')
    }
    const newValue = numeric ? String(val) : val
    if(apiVtype){
      try{
        const res = await axios.post(`${API_BASE_URL}/billing/product-variables/${apiVtype}`, { value: newValue })
        // optimistic: append value if not already present
        if(!items.includes(newValue)){
          const next = [...items, newValue]
          setItems(next)
          try{ localStorage.setItem(storageKey, JSON.stringify(next)) }catch(e){}
        }
        setVal('')
      }catch(err){
        alert('Failed to save to server. Try again or use local settings.')
      }
      return
    }
    // fallback: localStorage
    const next = [...items, newValue]
    setItems(next)
    try{ localStorage.setItem(storageKey, JSON.stringify(next)) }catch(e){}
    setVal('')
  }
  const removeAt = async idx => {
    if(!confirm('Remove this item?')) return
    const value = items[idx]
    if(apiVtype){
      try{
        await axios.delete(`${API_BASE_URL}/billing/product-variables/${apiVtype}`, { data: { value } })
        const next = items.filter((_,i)=>i!==idx)
        setItems(next)
        try{ localStorage.setItem(storageKey, JSON.stringify(next)) }catch(e){}
      }catch(err){
        alert('Failed to remove from server. Try again.')
      }
      return
    }
    const next = items.filter((_,i)=>i!==idx)
    setItems(next)
    try{ localStorage.setItem(storageKey, JSON.stringify(next)) }catch(e){}
  }
  return (
    <div className="mb-4">
      <h3 className="font-semibold">{title}{loadingVars ? ' (loading...)' : ''}</h3>
      <div className="flex gap-2 my-2">
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder={placeholder} className="input" />
        <button className="btn" onClick={save}>Add</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {items.map((it,idx)=> (
          <div key={idx} className="px-2 py-1 bg-gray-100 rounded flex items-center gap-2">
            <span>{it}</span>
            <button className="text-red-500" onClick={()=>removeAt(idx)}>×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
