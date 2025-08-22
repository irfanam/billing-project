import React from 'react';

export default function Navbar() {
  return (
    <nav className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
      <div className="font-bold text-lg">Billing App</div>
      <div className="space-x-4">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">New Sale</button>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow">New Purchase</button>
      </div>
    </nav>
  );
}
