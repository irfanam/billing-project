export function formatCurrency(value, { currencySymbol = '₹', decimals = 2 } = {}) {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (isNaN(num)) return ''
  return currencySymbol + num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default formatCurrency
