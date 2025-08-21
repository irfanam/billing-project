import React from 'react';

export default function StockAlert({ product, qty }) {
  return (
    <div className="bg-red-100 text-red-800 p-2 rounded mb-2">
      Low stock: {product} (only {qty} left)
    </div>
  );
}
