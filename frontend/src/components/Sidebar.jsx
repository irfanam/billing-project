import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const { theme } = useSettings();
  return (
    <>
      <button
        className={`md:hidden p-2 m-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-gray-200'}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
      >
        <span className="text-xl">{open ? '✖' : '☰'}</span>
      </button>
      {open && (
        <aside className={`w-64 min-h-screen p-4 fixed md:static z-20 ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-100'}`}>
          <nav className="flex flex-col space-y-2">
            <Link to="/" className="font-semibold">Dashboard</Link>
            <Link to="/invoices">Invoices</Link>
            <Link to="/customers">Customers</Link>
            <Link to="/products">Products</Link>
            <Link to="/reports">Reports</Link>
            <Link to="/settings">Settings</Link>
          </nav>
        </aside>
      )}
    </>
  );
};

export default Sidebar;
