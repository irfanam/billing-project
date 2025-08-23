export function formatCurrency(value, { currency = 'INR', decimals = 2 } = {}) {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (isNaN(num)) return ''
  try {
    // Use Intl.NumberFormat for proper locale-aware formatting
    // For INR use 'en-IN' locale to get grouping as per Indian system if desired
    const locale = currency === 'INR' ? 'en-IN' : undefined
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)
  } catch (e) {
    // Fallback: symbol + fixed number
    const symbol = currency === 'INR' ? '₹' : ''
    return symbol + num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }
}

export default formatCurrency
