import React from 'react';
import { useLocation } from 'react-router-dom';

export default function SupplierDetail(){
  const { state } = useLocation()
  const supplier = state?.supplier || {}
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Supplier Detail</h1>
      <div className="bg-white p-4 rounded shadow">
        <div className="grid grid-cols-2 gap-2">
          <div><strong>Supplier Code</strong><div>{supplier.supplier_code || supplier.id}</div></div>
          <div><strong>Name</strong><div>{supplier.name}</div></div>
          <div><strong>Contact</strong><div>{supplier.contact}</div></div>
          <div><strong>Email</strong><div>{supplier.email}</div></div>
        </div>
      </div>
    </div>
  )
}
