import React from 'react';
import { useSettings } from '../context/SettingsContext';

const Navbar = () => {
  const { theme } = useSettings();
  return (
    <nav className={`px-4 py-2 flex items-center justify-between ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-800 text-white'}`}>
      <div className="font-bold text-lg">Billing App</div>
      <div className="space-x-4">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">New Sale</button>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow">New Purchase</button>
      </div>
    </nav>
  );
};

export default Navbar;
