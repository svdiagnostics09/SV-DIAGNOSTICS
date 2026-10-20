/** Presentation helpers safe to import from client and server components. */

export const IST = 'Asia/Kolkata'

/** Integer paise → formatted INR, without decimals when whole. */
export function formatINR(paise: number) {
  const value = Number(paise || 0) / 100
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })
}

export function formatIndiaTime(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST, ...options }).format(typeof value === 'string' ? new Date(value) : value)
}

export const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' }).format(typeof value === 'string' ? new Date(value) : value)
