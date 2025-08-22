import React from 'react';
import { useLocation } from 'react-router-dom';

export default function CustomerDetail() {
  const { state } = useLocation();
  const customer = state?.customer || {};
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Customer Detail</h1>
      <div className="bg-white shadow rounded p-4">
        <div className="grid grid-cols-2 gap-2">
          <div><strong>Customer Code</strong><div>{customer.customer_code || customer.id}</div></div>
          <div><strong>Name</strong><div>{customer.name}</div></div>
          <div><strong>State</strong><div>{customer.state}</div></div>
          <div><strong>GSTIN</strong><div>{customer.gstin}</div></div>
          <div><strong>Email</strong><div>{customer.email}</div></div>
        </div>
      </div>
    </div>
  );
}
