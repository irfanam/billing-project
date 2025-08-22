import React, { useState, useEffect } from 'react';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function Products() {
  const [products, setProducts] = useState([]);
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
        setProducts(res.data.data || []);
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

  // Filter and search logic
  const filtered = products.filter(prod =>
    prod.name?.toLowerCase().includes(search.toLowerCase()) ||
    prod.sku?.toLowerCase().includes(search.toLowerCase()) ||
    prod.id?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, SKU, or ID"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1"
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded shadow ml-auto" onClick={() => { setEditProduct(null); setShowForm(true); }}>Add Product</button>
      </div>
      {showForm && (
        <ProductForm
          product={editProduct}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          onSaved={() => { setShowForm(false); setEditProduct(null); fetchProducts(); }}
        />
      )}
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
                    <td className="px-2 py-1">{prod.id}</td>
                    <td className="px-2 py-1">{prod.sku}</td>
                    <td className="px-2 py-1">{prod.name}</td>
                    <td className="px-2 py-1">${prod.price}</td>
                    <td className="px-2 py-1">{prod.tax_percent}%</td>
                    <td className="px-2 py-1">{prod.stock_qty}</td>
                    <td className="px-2 py-1 text-center">
                      <button className="text-blue-600 hover:underline mr-2">View</button>
                      <button className="text-green-600 hover:underline mr-2" onClick={() => { setEditProduct(prod); setShowForm(true); }}>Edit</button>
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

function ProductForm({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price !== undefined ? String(product.price) : '',
    tax_percent: product?.tax_percent !== undefined ? String(product.tax_percent) : '',
    stock_qty: product?.stock_qty !== undefined ? String(product.stock_qty) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Ensure correct types for backend
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description,
      price: form.price !== '' ? parseFloat(form.price) : undefined,
      tax_percent: form.tax_percent !== '' ? parseFloat(form.tax_percent) : undefined,
      stock_qty: form.stock_qty !== '' ? parseInt(form.stock_qty) : undefined,
    };
    try {
      if (product && product.id) {
        // Edit
        await axios.put(`${API_BASE_URL}/billing/products/${product.id}`, payload);
      } else {
        // Add
        await axios.post(`${API_BASE_URL}/billing/products`, payload);
      }
      setSaving(false);
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
          <input name="sku" value={form.sku} onChange={handleChange} className="input" required />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Name</label>
          <input name="name" value={form.name} onChange={handleChange} className="input" required />
        </div>
        <div className="mb-2">
          <label className="block font-semibold">Description</label>
          <input name="description" value={form.description} onChange={handleChange} className="input" />
        </div>
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
