import React from 'react';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const { currency, setCurrency, theme, setTheme } = useSettings();

  return (
    <div className={`max-w-md mx-auto p-6 rounded shadow mt-8 ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white'}`}>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Currency</label>
        <select
          className="input"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
          <option value="INR">INR (₹)</option>
          <option value="JPY">JPY (¥)</option>
        </select>
      </div>
      <div>
        <label className="block mb-2 font-semibold">Theme</label>
        <div className="flex space-x-4">
          <button
            className={`btn ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            className={`btn ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'}`}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>
    </div>
  );
}
