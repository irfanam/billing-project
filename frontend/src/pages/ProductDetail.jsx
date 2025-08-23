import React from 'react';
import { useLocation } from 'react-router-dom';
import formatCurrency from '../utils/formatCurrency';

export default function ProductDetail() {
  const { state } = useLocation();
  const product = state?.product || {};
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Product Detail</h1>
      <div className="bg-white shadow rounded p-4">
        <div className="grid grid-cols-2 gap-2">
          <div><strong>Product Code</strong><div>{product.product_code || product.id}</div></div>
          <div><strong>SKU</strong><div>{product.sku}</div></div>
          <div><strong>Name</strong><div>{product.name}</div></div>
          <div><strong>Price</strong><div>{formatCurrency(product.price)}</div></div>
          <div><strong>Stock</strong><div>{product.stock_qty}</div></div>
        </div>
      </div>
    </div>
  );
}
