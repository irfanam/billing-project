import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import formatCurrencyUtil from '../utils/formatCurrency';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'USD');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const formatCurrency = useMemo(() => (value, opts = {}) => {
    // allow override of currency via opts, otherwise use context currency
    const currencyToUse = opts.currency || currency || 'INR';
    const decimals = opts.decimals !== undefined ? opts.decimals : 2;
    return formatCurrencyUtil(value, { currency: currencyToUse, decimals });
  }, [currency]);

  return (
    <SettingsContext.Provider value={{ currency, setCurrency, theme, setTheme, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
