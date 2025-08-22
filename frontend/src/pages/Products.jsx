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
                {supportsMeta && <th className="px-2 py-1 text-left">Company</th>}
                <th className="px-2 py-1 text-left">Price</th>
                <th className="px-2 py-1 text-left">Tax %</th>
                <th className="px-2 py-1 text-left">Stock</th>
                <th className="px-2 py-1 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-gray-500">No products found.</td>
                </tr>
              ) : (
                paginated.map(prod => (
                  <tr key={prod.id} className="border-b">
                    <td className="px-2 py-1">{prod.product_code || prod.id}</td>
                    <td className="px-2 py-1">{prod.sku}</td>
                    <td className="px-2 py-1">{prod.name}</td>
                    {supportsMeta && (
                      <td className="px-2 py-1">{prod.meta?.company || '—'}</td>
                    )}
                    <td className="px-2 py-1">${prod.price}</td>
                    <td className="px-2 py-1">{prod.tax_percent}%</td>
                    <td className="px-2 py-1">{prod.stock_qty}</td>
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
            <SimpleListEditor title="Companies" storageKey="product_companies" items={companies} setItems={setCompanies} placeholder="Add company" />
            <SimpleListEditor title="Variants (Size)" storageKey="product_variants" items={variants} setItems={setVariants} placeholder="Add variant (e.g. Small)" />
            <SimpleListEditor title="GST Rates" storageKey="product_gst_rates" items={gstRates} setItems={setGstRates} placeholder="Add GST rate (e.g. 18)" numeric />
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
  const [form, setForm] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price !== undefined ? String(product.price) : '',
    tax_percent: product?.tax_percent !== undefined ? String(product.tax_percent) : '',
    stock_qty: product?.stock_qty !== undefined ? String(product.stock_qty) : '',
    company: product?.meta?.company || (companies[0] || ''),
    variant: product?.meta?.variant || (variants[0] || ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  };

  const handleGstSelect = e => {
    const v = e.target.value
    setForm(f => ({ ...f, tax_percent: v }))
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
      stock_qty: form.stock_qty !== '' ? parseInt(form.stock_qty) : undefined,
    };
    if (supportsMeta) {
      payload.meta = {
        company: form.company || undefined,
        variant: form.variant || undefined
      }
    } else {
      if (form.company || form.variant) {
        payload.description = `${payload.description || ''} ${form.company ? `| Company: ${form.company}`: ''} ${form.variant ? `| Variant: ${form.variant}`: ''}`.trim()
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
      setForm({ sku: '', name: '', description: '', price: '', tax_percent: '', stock_qty: '', company: companies[0] || '', variant: variants[0] || '' })
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
        {variants && variants.length>0 && (
          <div className="mb-2">
            <label className="block font-semibold">Variant (Size)</label>
            <select name="variant" value={form.variant} onChange={handleChange} className="input">
              <option value="">-- select variant --</option>
              {variants.map((v,idx)=> <option key={idx} value={v}>{v}</option>)}
            </select>
          </div>
        )}
        {gstRates && gstRates.length>0 && (
          <div className="mb-2">
            <label className="block font-semibold">GST Rate</label>
            <select name="gst_select" value={form.tax_percent} onChange={handleGstSelect} className="input">
              <option value="">-- select GST % --</option>
              {gstRates.map((g,idx)=> <option key={idx} value={g}>{g}%</option>)}
            </select>
          </div>
        )}
        <div className="mb-2">
          <label className="block font-semibold">Price</label>
          <input name="price" value={form.price} onChange={handleChange} className="input" type="number" step="0.01" required />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Tax %</label>
          <input name="tax_percent" value={form.tax_percent} onChange={handleChange} className="input" type="number" step="0.01" />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Stock Qty</label>
          <input name="stock_qty" value={form.stock_qty} onChange={handleChange} className="input" type="number" required />
        </div>
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" className="btn bg-gray-400" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function SimpleListEditor({ title, storageKey, items, setItems, placeholder, numeric }){
  const [val, setVal] = useState('')
  const save = ()=>{
    if(!val) return
    if(numeric){
      // validate numeric
      const n = parseFloat(val)
      if(Number.isNaN(n)) return alert('Please enter a numeric value for this list')
    }
    const next = [...items, numeric ? String(val) : val]
    setItems(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    setVal('')
  }
  const removeAt = idx => {
    if(!confirm('Remove this item?')) return
    const next = items.filter((_,i)=>i!==idx)
    setItems(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }
  return (
    <div className="mb-4">
      <h3 className="font-semibold">{title}</h3>
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
