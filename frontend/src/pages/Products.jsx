import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function Products() {
  const { formatCurrency } = useSettings();
  const [activeTab, setActiveTab] = useState('list')
  const [companies, setCompanies] = useState([])
  const [variants, setVariants] = useState([])
  const [gstRates, setGstRates] = useState([])
  const [types, setTypes] = useState([])
  const [vtypeEnabled, setVtypeEnabled] = useState({})

  // load settings from localStorage
  useEffect(()=>{
    try{
    const c = JSON.parse(localStorage.getItem('product_companies')||'[]')
    const v = JSON.parse(localStorage.getItem('product_variants')||'[]')
    const g = JSON.parse(localStorage.getItem('product_gst_rates')||'[]')
    const t = JSON.parse(localStorage.getItem('product_types')||'[]')
    setCompanies(c)
    setVariants(v)
    setGstRates(g)
    setTypes(t)
      }catch(e){/* ignore */}
  },[])
  const [products, setProducts] = useState([]);
  const [supportsMeta, setSupportsMeta] = useState(false);
  const [topSuccessMessage, setTopSuccessMessage] = useState('')
  const [topToast, setTopToast] = useState('')
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewProduct, setViewProduct] = useState(null)
  const [archivedProducts, setArchivedProducts] = useState([])
  const pageSize = 10;

  const fetchProducts = () => {
    setLoading(true);
    setError(null);
    axios.get(`${API_BASE_URL}/billing/products`)
      .then(res => {
        const data = res.data.data || [];
        setProducts(data);
        // detect if backend supports a `meta` JSON column on products
        if (data.length > 0 && data[0].meta) {
          const m = data[0].meta
          const metaIsObject = typeof m === 'object'
          const metaIsJsonString = typeof m === 'string' && m.trim().startsWith('{')
          setSupportsMeta(metaIsObject || metaIsJsonString)
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

  const fetchArchivedProducts = () => {
    axios.get(`${API_BASE_URL}/billing/products/archived`)
      .then(res => {
        const data = (res.data && res.data.data) ? res.data.data : []
        setArchivedProducts(data)
      })
      .catch(()=>{
        setArchivedProducts([])
      })
  }

  useEffect(() => {
    fetchProducts();
  }, []);
  useEffect(()=>{
    // fetch all vtype flags in one request
    (async ()=>{
      try{
        const resp = await axios.get(`${API_BASE_URL}/billing/product-variable-types`)
        const data = resp.data && resp.data.data ? resp.data.data : {}
        setVtypeEnabled(data)
      }catch(e){
        // default: enable all (include product_code previously)
  setVtypeEnabled({ company: true, variant: true, gst: true, type: true })
      }
    })()
  }, [])

  // Helper to read values from product.meta (handles stringified JSON and case-insensitive keys)
  const getMetaValue = (prod, key) => {
    if (!prod) return undefined
    const lookup = (obj, k) => {
      if (!obj || typeof obj !== 'object') return undefined
      if (obj[k] !== undefined) return obj[k]
      const low = k.toString().toLowerCase()
      for (const kk of Object.keys(obj)) {
        try { if (String(kk).toLowerCase() === low) return obj[kk] } catch (e) { continue }
      }
      return undefined
    }

    // meta may be null or a JSON string
    if (prod.meta) {
      let metaObj = prod.meta
      if (typeof metaObj === 'string') {
        try { metaObj = JSON.parse(metaObj) } catch (e) { metaObj = null }
      }
      const fromMeta = lookup(metaObj, key)
      if (fromMeta !== undefined) return fromMeta
    }

    // fallback to top-level fields (case-insensitive)
    const top = lookup(prod, key)
    if (top !== undefined) return top

    // Helper: prefer explicit p_code/product_code in meta then top-level product_code, else id
    if (key === 'product_code') {
      try {
        if (prod && prod.meta) {
          const m = (typeof prod.meta === 'object') ? prod.meta : (() => { try { return JSON.parse(prod.meta) } catch(e){ return null } })()
          if (m && (m.p_code || m.product_code || m.productCode || m.code)) return m.p_code || m.product_code || m.productCode || m.code
        }
      } catch (e) { /* ignore parsing errors */ }
      const top2 = prod.product_code || prod.productCode || prod.code
      return top2 || undefined
    }

    // try snake_case of the key on top-level
    const snake = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
    if (prod[snake] !== undefined) return prod[snake]
    return undefined
  }

  // Filter and search logic
  const [filterCompany, setFilterCompany] = useState('')
  const [filterVariant, setFilterVariant] = useState('')
  const [filterGst, setFilterGst] = useState('')

  const filtered = products.filter(prod =>
    prod.name?.toLowerCase().includes(search.toLowerCase()) ||
    prod.sku?.toLowerCase().includes(search.toLowerCase()) ||
    // match what's visible in Product ID column (UID from meta/top-level or id)
    ((String(getMetaValue(prod, 'p_code') || getMetaValue(prod, 'product_code') || prod.product_code || prod.id) || '').toLowerCase().includes(search.toLowerCase()))
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
      {topSuccessMessage && (
        <div className="mb-3 p-2 bg-green-100 text-green-800 rounded">{topSuccessMessage}</div>
      )}
      {topToast && (
        <div className="mb-3 p-2 bg-yellow-100 text-yellow-800 rounded">{topToast}</div>
      )}

      
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${activeTab==='list'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setActiveTab('list')}>List</button>
        <button className={`px-3 py-1 rounded ${activeTab==='archived'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>{ setActiveTab('archived'); fetchArchivedProducts()}}>Archived</button>
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
        {activeTab === 'list' && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded shadow ml-auto" onClick={() => { setEditProduct(null); setShowForm(true); }}>Add Product</button>
        )}
      </div>
      )}
    {showForm && (
        <ProductForm
          product={editProduct}
      onClose={() => { setShowForm(false); setEditProduct(null); }}
      onSaved={(payload) => { setShowForm(false); setEditProduct(null); fetchProducts(); if (payload && payload.message) { setTopSuccessMessage(payload.message); setTimeout(()=>setTopSuccessMessage(''),3000) } }}
      companies={companies}
      variants={variants}
      gstRates={gstRates}
      supportsMeta={supportsMeta}
  types={types}
  vtypeEnabled={vtypeEnabled}
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
                { (vtypeEnabled['type'] ?? true) && <th className="px-2 py-1 text-left">Type</th> }
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
          <td className="px-2 py-1">{getMetaValue(prod, 'p_code') || getMetaValue(prod, 'product_code') || prod.product_code || prod.id}</td>
                    <td className="px-2 py-1">{prod.sku}</td>
                    <td className="px-2 py-1">{(() => {
                      // Display name without any appended variant. If meta.company exists, prefix it
                      // but avoid adding the prefix twice when the saved name already contains it.
                      let base = typeof prod.name === 'string' ? prod.name : ''
                      if (base.includes(' — ')) {
                        base = base.split(' — ')[0].trim()
                      }
                      if (prod.meta && prod.meta.company) {
                        const prefix = `${prod.meta.company} - `
                        if (typeof base === 'string' && base.toLowerCase().startsWith(prefix.toLowerCase())) {
                          return base
                        }
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
                    { (vtypeEnabled['type'] ?? true) && <td className="px-2 py-1">{getMetaValue(prod, 'type') ?? '—'}</td> }
                    
                    <td className="px-2 py-1">{prod.price ? formatCurrency(prod.price) : '—'}</td>
                    <td className="px-2 py-1">{prod.tax_percent ? `${prod.tax_percent}%` : '—'}</td>
                    <td className="px-2 py-1">
                      {(() => {
                        const price = Number(prod.price) || 0
                        const tax = Number(prod.tax_percent) || 0
                        const total = price + (price * (tax / 100))
                        return formatCurrency(total)
                      })()}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button className="px-2 py-1 bg-gray-200 text-gray-800 rounded mr-2" onClick={() => setViewProduct(prod)}>View</button>
                      <button className="px-2 py-1 bg-green-100 text-green-800 rounded mr-2" onClick={() => { setEditProduct(prod); setShowForm(true); }}>Edit</button>
                      <button className="px-2 py-1 bg-red-100 text-red-800 rounded" onClick={() => { setDeleteTarget(prod); setShowDeleteConfirm(true); }}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
        )}

      {activeTab === 'archived' && (
        <div className="bg-white shadow rounded p-4 overflow-x-auto">
          {archivedProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No archived products.</div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-left">Product ID</th>
                  <th className="px-2 py-1 text-left">SKU</th>
                  <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Variant</th>
                    { (vtypeEnabled['type'] ?? true) && <th className="px-2 py-1 text-left">Type</th> }
                    {/* Product CODE column removed */}
                    <th className="px-2 py-1 text-left">Amount</th>
                    <th className="px-2 py-1 text-left">GST</th>
                    <th className="px-2 py-1 text-left">Total Price</th>
                  <th className="px-2 py-1 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
        {archivedProducts.map(prod => (
                  <tr key={prod.id} className="border-b">
          <td className="px-2 py-1">{getMetaValue(prod, 'p_code') || getMetaValue(prod, 'product_code') || prod.product_code || prod.id}</td>
                    <td className="px-2 py-1">{prod.sku}</td>
                    <td className="px-2 py-1">{(() => {
                      let base = typeof prod.name === 'string' ? prod.name : ''
                      if (base.includes(' — ')) base = base.split(' — ')[0].trim()
                      if (prod.meta && prod.meta.company) {
                        const prefix = `${prod.meta.company} - `
                        if (typeof base === 'string' && base.toLowerCase().startsWith(prefix.toLowerCase())) return base
                        return `${prod.meta.company} - ${base}`
                      }
                      return base
                    })()}</td>
                      <td className="px-2 py-1">{prod.meta && prod.meta.variant ? prod.meta.variant : '—'}</td>
                      { (vtypeEnabled['type'] ?? true) && <td className="px-2 py-1">{getMetaValue(prod, 'type') ?? '—'}</td> }
                    
                      <td className="px-2 py-1">{prod.price ? formatCurrency(prod.price) : '—'}</td>
                      <td className="px-2 py-1">{prod.tax_percent ? `${prod.tax_percent}%` : '—'}</td>
                      <td className="px-2 py-1">{(() => { const price = Number(prod.price) || 0; const tax = Number(prod.tax_percent) || 0; return formatCurrency(price + (price * (tax/100))) })()}</td>
                    <td className="px-2 py-1 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="px-2 py-1 bg-gray-200 text-gray-800 rounded" onClick={()=>setViewProduct(prod)}>View</button>
                        <button className="px-2 py-1 bg-green-100 text-green-800 rounded" onClick={async ()=>{
                          if(!confirm('Restore this product from archive?')) return
                          try{
                            await axios.post(`${API_BASE_URL}/billing/products/${prod.id}/undelete`)
                            fetchArchivedProducts()
                            fetchProducts()
                            setTopToast('Product restored')
                            setTimeout(()=>setTopToast(''), 3000)
                          }catch(err){
                            let msg = 'Failed to restore product'
                            try{ if(err.response && err.response.data && err.response.data.detail) msg = err.response.data.detail }catch(e){}
                            alert(msg)
                          }
                        }}>Undelete</button>
                        <button className="px-2 py-1 bg-red-100 text-red-800 rounded" onClick={async ()=>{
                          if(!confirm('Delete this archived product permanently?')) return
                          try{
                            await axios.delete(`${API_BASE_URL}/billing/products/${prod.id}`)
                            fetchArchivedProducts()
                            fetchProducts()
                            setTopToast('Archived product deleted')
                            setTimeout(()=>setTopToast(''), 3000)
                          }catch(err){
                            let msg = 'Failed to delete archived product'
                            try{ if(err.response && err.response.data && err.response.data.detail) msg = err.response.data.detail }catch(e){}
                            alert(msg)
                          }
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-3">Confirm delete</h3>
            <p className="mb-4">Are you sure you want to delete <strong>{deleteTarget.name || deleteTarget.id}</strong>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={()=>{ setShowDeleteConfirm(false); setDeleteTarget(null) }}>Cancel</button>
              <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={async ()=>{
                try{
                  const resp = await axios.delete(`${API_BASE_URL}/billing/products/${deleteTarget.id}`)
                  const data = resp.data || {}
                  if(data.deleted === 'soft'){
                    setTopToast("Product archived (couldn't delete due to existing invoices)")
                    setTimeout(()=>setTopToast(''), 4000)
                  }
                  setProducts(products.filter(p => p.id !== deleteTarget.id))
                }catch(err){
                  let msg = 'Failed to delete product'
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

      {viewProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-full max-w-lg overflow-auto max-h-[80vh]">
            <h3 className="text-xl font-semibold mb-3">Product details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
              <div><strong>Product ID</strong><div className="mt-1">{getMetaValue(viewProduct, 'p_code') || getMetaValue(viewProduct, 'product_code') || viewProduct.product_code || viewProduct.id}</div></div>
              <div><strong>SKU</strong><div className="mt-1">{viewProduct.sku}</div></div>
              <div><strong>Name</strong><div className="mt-1">{viewProduct.name}</div></div>
              <div><strong>Price</strong><div className="mt-1">{viewProduct.price ? formatCurrency(viewProduct.price) : '—'}</div></div>
              <div><strong>Selling Price</strong><div className="mt-1">{getMetaValue(viewProduct, 'selling_price') ? formatCurrency(getMetaValue(viewProduct, 'selling_price')) : (viewProduct.selling_price ? formatCurrency(viewProduct.selling_price) : '—')}</div></div>
              <div><strong>GST</strong><div className="mt-1">{viewProduct.tax_percent ? `${viewProduct.tax_percent}%` : '—'}</div></div>
              <div><strong>Total Price</strong><div className="mt-1">{viewProduct.total_price ? formatCurrency(viewProduct.total_price) : '—'}</div></div>
              <div><strong>Stock</strong><div className="mt-1">{viewProduct.stock_qty ?? '—'}</div></div>
              <div className="col-span-2"><strong>Description</strong><div className="mt-1 whitespace-pre-wrap">{viewProduct.description || '—'}</div></div>
            </div>
            <hr className="my-3" />
            {/* Render known meta fields as regular detail rows (no 'Variables' heading) */}
              <div className="grid grid-cols-2 gap-3 text-sm mt-2">
              <div><strong>Type</strong><div className="mt-1">{getMetaValue(viewProduct, 'type') ?? '—'}</div></div>
              <div><strong>Company</strong><div className="mt-1">{getMetaValue(viewProduct, 'company') ?? '—'}</div></div>
              <div><strong>Variant</strong><div className="mt-1">{getMetaValue(viewProduct, 'variant') ?? '—'}</div></div>
              <div><strong>Selling Price</strong><div className="mt-1">{getMetaValue(viewProduct, 'selling_price') ? formatCurrency(getMetaValue(viewProduct, 'selling_price')) : (viewProduct.selling_price ? formatCurrency(viewProduct.selling_price) : '—')}</div></div>
              {(() => {
                const metaRaw = viewProduct.meta
                let metaObj = metaRaw
                if (metaRaw && typeof metaRaw === 'string') {
                  try { metaObj = JSON.parse(metaRaw) } catch(e){ metaObj = null }
                }
                if (!metaObj || Object.keys(metaObj).length === 0) return null
                const order = ['company', 'variant', 'type', 'selling_price', 'productCode', 'code']
                const excluded = new Set(order)
                const extras = Object.keys(metaObj).filter(k => !excluded.has(k))
                return extras.map(k => (
                  <div key={k} className="col-span-2"><strong>{k.replace(/_/g, ' ')}</strong><div className="mt-1">{k === 'selling_price' && typeof metaObj[k] === 'number' ? formatCurrency(metaObj[k]) : String(metaObj[k])}</div></div>
                ))
              })()}
            </div>
            <div className="flex justify-end mt-4">
              <button className="px-3 py-1 border rounded" onClick={()=>setViewProduct(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

        {activeTab === 'settings' && (
          <div className="bg-white shadow rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Product Settings</h2>
            <p className="text-sm text-gray-600 mb-4">Manage variables that can be selected when adding a product.</p>
            <VtypeToggleAndEditor vtype="company" title="Companies" storageKey="product_companies" items={companies} setItems={setCompanies} placeholder="Add company" apiVtype="company" enabled={vtypeEnabled['company']} setVtypeEnabled={setVtypeEnabled} />
            <VtypeToggleAndEditor vtype="variant" title="Variants (Size)" storageKey="product_variants" items={variants} setItems={setVariants} placeholder="Add variant (e.g. Small)" apiVtype="variant" enabled={vtypeEnabled['variant']} setVtypeEnabled={setVtypeEnabled} />
            <VtypeToggleAndEditor vtype="gst" title="GST Rates" storageKey="product_gst_rates" items={gstRates} setItems={setGstRates} placeholder="Add GST rate (e.g. 18)" numeric apiVtype="gst" enabled={vtypeEnabled['gst']} setVtypeEnabled={setVtypeEnabled} />
            <VtypeToggleAndEditor vtype="type" title="Type" storageKey="product_types" items={types} setItems={setTypes} placeholder="Add product type (e.g. Raw/Finished)" apiVtype="type" enabled={vtypeEnabled['type']} setVtypeEnabled={setVtypeEnabled} />
            
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

function ProductForm({ product, onClose, onSaved, companies = [], variants = [], gstRates = [], supportsMeta = false, types = [], vtypeEnabled = {} }) {
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
  type: (typeof getMetaValue === 'function' ? (getMetaValue(product, 'type') ?? (types[0] || '')) : (product?.meta?.type || (types[0] || ''))),
  // product_code removed; keep meta-derived selling_price/type/company/variant
  selling_price: (typeof getMetaValue === 'function' ? (getMetaValue(product, 'selling_price') !== undefined ? String(getMetaValue(product, 'selling_price')) : (product?.selling_price !== undefined ? String(product.selling_price) : '')) : (product?.meta?.selling_price !== undefined ? String(product.meta.selling_price) : (product?.selling_price !== undefined ? String(product.selling_price) : ''))),
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastEdited, setLastEdited] = useState('amount') // 'amount' or 'total'
  const [successMessage, setSuccessMessage] = useState('')
  const successTimerRef = React.useRef(null)
  const [errorMessage, setErrorMessage] = useState('')

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
    // Always include meta object; backend will gracefully handle missing meta column.
    payload.meta = {
      company: form.company || undefined,
      variant: form.variant || undefined,
  // Always attach optional fields so they are persisted if the backend supports them.
  type: form.type || undefined,
  selling_price: form.selling_price !== '' ? parseFloat(form.selling_price) : undefined
    }

    // If backend doesn't support meta, still ensure name/variant formatting
    if (!supportsMeta) {
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
      // show confirmation when added or updated
      const verb = product && product.id ? 'updated' : 'added'
      setSuccessMessage(`Product ${verb} successfully`)
      setErrorMessage('')
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000)
  // reset form for next use
  setForm({ sku: '', name: '', description: '', price: '', total_price: '', tax_percent: '', company: companies[0] || '', variant: variants[0] || '', type: types[0] || '', selling_price: '' })
  const message = `Product ${verb} successfully`
  onSaved && onSaved({ message });
    } catch (err) {
      // extract server error if available
      let detail = ''
      try {
        if (err.response && err.response.data) {
          detail = err.response.data.detail || JSON.stringify(err.response.data)
        } else {
          detail = err.message || String(err)
        }
      } catch (e) { detail = String(err) }
      setError('Failed to save product')
      setErrorMessage(detail)
      setSuccessMessage('')
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form className="bg-white rounded shadow p-6 w-full max-w-md" onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-4">{product ? 'Edit Product' : 'Add Product'}</h2>
        {successMessage && (
          <div className="mb-3 p-2 bg-green-100 text-green-800 rounded">{successMessage}</div>
        )}
        {errorMessage && (
          <div className="mb-3 p-2 bg-red-100 text-red-800 rounded">{errorMessage}</div>
        )}
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
        { (vtypeEnabled['company'] ?? true) && companies && companies.length>0 && (
          <div className="mb-2">
            <label className="block font-semibold">Company</label>
            <select name="company" value={form.company} onChange={handleChange} className="input">
              <option value="">-- select company --</option>
              {companies.map((c,idx)=> <option key={idx} value={c}>{c}</option>)}
            </select>
          </div>
        )}
          { (vtypeEnabled['type'] ?? true) && types && types.length>0 && (
            <div className="mb-2">
              <label className="block font-semibold">Type</label>
              <select name="type" value={form.type} onChange={handleChange} className="input">
                <option value="">-- select type --</option>
                {types.map((t,idx)=> <option key={idx} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          
        {(vtypeEnabled['variant'] ?? true) && (
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
        )}
        {(vtypeEnabled['gst'] ?? true) && (
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
        )}
        <div className="mb-2">
          <label className="block font-semibold">Amount (pre-tax)</label>
          <input name="price" value={form.price} onChange={handleAmountChange} className="input" type="number" step="0.01" required />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Selling Price (suggested)</label>
          <input name="selling_price" value={form.selling_price || ''} onChange={handleChange} className="input" type="number" step="0.01" placeholder="Optional selling price" />
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

function SimpleListEditor({ title, storageKey, items, setItems, placeholder, numeric, apiVtype, showTitle = true }){
  const [val, setVal] = useState('')
  const [loadingVars, setLoadingVars] = useState(false)
  const [rows, setRows] = useState([]) // internal rows of { value, enabled }

  // Try to load from API when apiVtype is provided. Fallback to localStorage is preserved.
  useEffect(()=>{
    if(!apiVtype) return;
    setLoadingVars(true)
    axios.get(`${API_BASE_URL}/billing/product-variables/${apiVtype}`)
      .then(res => {
        // API may return either an array of rows, or an object { vtype_enabled, rows }
        let payload = (res.data && res.data.data) ? res.data.data : []
        let data = []
        if (Array.isArray(payload)) {
          data = payload
        } else if (payload && Array.isArray(payload.rows)) {
          data = payload.rows
        }
        // Normalize: if items are simple strings, map to { value, enabled: true }
        if(data.length > 0 && typeof data[0] === 'string'){
          data = data.map(v => ({ value: v, enabled: true }))
        }
        // rows hold full objects for toggles/UI; parent items should stay as enabled value strings
        setRows(data)
        const enabledValues = data.filter(d => d.enabled !== false).map(d => d.value)
        setItems(enabledValues)
        try{ localStorage.setItem(storageKey, JSON.stringify(enabledValues)) }catch(e){}
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
        // backend returns the created row; try to insert normalized object
        const created = (res.data && res.data.data) ? res.data.data : null
        let newRow = null
        if(created && typeof created === 'object'){
          newRow = created
        } else {
          newRow = { value: newValue, enabled: true }
        }
        // update internal rows and parent items (enabled values)
        const nextRows = [...rows]
        if(!nextRows.find(r => (r.value || r) === newRow.value)) nextRows.push(newRow)
        setRows(nextRows)
        const enabledValues = nextRows.filter(d => d.enabled !== false).map(d => d.value)
        setItems(enabledValues)
        try{ localStorage.setItem(storageKey, JSON.stringify(enabledValues)) }catch(e){}
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
    let value
    if(apiVtype){
      const entry = rows[idx]
      value = entry && (entry.value || entry)
      try{
        await axios.delete(`${API_BASE_URL}/billing/product-variables/${apiVtype}`, { data: { value } })
        const nextRows = rows.filter((_,i)=>i!==idx)
        setRows(nextRows)
        const enabledValues = nextRows.filter(d => d.enabled !== false).map(d => d.value)
        setItems(enabledValues)
        try{ localStorage.setItem(storageKey, JSON.stringify(enabledValues)) }catch(e){}
      }catch(err){
        alert('Failed to remove from server. Try again.')
      }
      return
    }
    value = items[idx]
    const next = items.filter((_,i)=>i!==idx)
    setItems(next)
    try{ localStorage.setItem(storageKey, JSON.stringify(next)) }catch(e){}
  }

  const toggleEnabled = async (idx) => {
    const it = rows[idx]
    const value = it.value || it
    try{
      await axios.post(`${API_BASE_URL}/billing/product-variables/${apiVtype}/toggle`, { value, enabled: !(it.enabled === undefined ? true : !!it.enabled) })
      // optimistic update rows
      const nextRows = rows.map((r,i)=> i===idx ? { ...(typeof r === 'object' ? r : { value: r }), enabled: !(r.enabled === undefined ? true : !!r.enabled) } : r)
      setRows(nextRows)
      const enabledValues = nextRows.filter(d => d.enabled !== false).map(d => d.value)
      setItems(enabledValues)
      try{ localStorage.setItem(storageKey, JSON.stringify(enabledValues)) }catch(e){}
    }catch(err){
      alert('Failed to update variable state')
    }
  }

  return (
    <div className="mb-2">
      {showTitle ? <h3 className="font-semibold">{title}{loadingVars ? ' (loading...)' : ''}</h3> : null}
      <div className="flex gap-2 my-1">
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder={placeholder} className="input" />
        <button className="btn" onClick={save}>Add</button>
      </div>
  <div className="flex gap-2 flex-wrap">
        {(apiVtype ? rows : items).map((it,idx)=> {
          const valText = it && (it.value || it)
          const enabled = it && (it.enabled === undefined ? true : it.enabled)
          return (
          <div key={idx} className="px-2 py-1 bg-gray-100 rounded flex items-center gap-2">
            <label className="flex items-center gap-2">
              {apiVtype ? <input type="checkbox" checked={!!enabled} onChange={()=>toggleEnabled(idx)} /> : null}
              <span>{valText}</span>
            </label>
            <button className="text-red-500" onClick={()=>removeAt(idx)}>×</button>
          </div>
        )})}
      </div>
    </div>
  )
}

function VtypeToggleAndEditor({ vtype, title, storageKey, items, setItems, placeholder, numeric, apiVtype, enabled=true, setVtypeEnabled }){
  const [localEnabled, setLocalEnabled] = useState(enabled === undefined ? true : enabled)
  useEffect(()=> setLocalEnabled(enabled === undefined ? true : enabled), [enabled])

  const toggleType = async () => {
    const next = !localEnabled
    try{
      await axios.post(`${API_BASE_URL}/billing/product-variable-types/${vtype}/toggle`, { enabled: next })
      setLocalEnabled(next)
      setVtypeEnabled && setVtypeEnabled(prev => ({ ...prev, [vtype]: next }))
    }catch(err){
      alert('Failed to update setting')
    }
  }

  return (
    <div className="mb-3 border-t pt-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">{title}</h3>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Enabled</span>
          <input type="checkbox" checked={!!localEnabled} onChange={toggleType} />
        </label>
      </div>
      {!localEnabled ? (
        <div className="text-sm text-gray-500 mb-1">This variable type is disabled and will not appear when adding products.</div>
      ) : null}
      <div style={{ opacity: localEnabled ? 1 : 0.5 }}>
        <SimpleListEditor title={title} storageKey={storageKey} items={items} setItems={setItems} placeholder={placeholder} numeric={numeric} apiVtype={apiVtype} showTitle={false} />
      </div>
    </div>
  )
}
