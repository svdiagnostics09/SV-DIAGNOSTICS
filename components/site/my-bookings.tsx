'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, Loader2, Phone, Search, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

/**
 * "My bookings" — find every booking attached to a mobile number.
 *
 * This is the alternative to Track booking (which needs the reference). The
 * number is the only input; the API returns summaries, and each row links into
 * the full timeline on /track.
 */

interface Summary {
  reference: string
  status: string
  statusLabel: string
  paymentStatus: string
  method: 'home' | 'lab'
  appointmentDate: string
  slotLabel: string
  totalPaise: number
  createdAt: string
  itemCount: number
  hasReport: boolean
}

const STATUS_TONE: Record<string, string> = {
  pending_confirmation: 'badge badge-amber',
  confirmed: 'badge badge-teal',
  collection_scheduled: 'badge badge-navy',
  sample_collected: 'badge badge-navy',
  processing: 'badge badge-navy',
  report_ready: 'badge badge-green',
  completed: 'badge badge-green',
  cancelled: 'badge badge-red',
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function MyBookings() {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ bookings: Summary[]; phone: string } | null>(null)

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Enter the 10-digit mobile number you booked with.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/my-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits.slice(-10) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error ?? 'Your bookings could not be retrieved. Please try again.')
        return
      }
      setResult(data)
    } catch {
      setError('Your bookings could not be retrieved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <form onSubmit={search} className="card p-5">
        <label htmlFor="my-phone" className="label">Mobile number</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Phone size={15} aria-hidden /></span>
            <input
              id="my-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/[^\d\s+-]/g, '').slice(0, 16))}
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              className="input pl-9"
              aria-invalid={Boolean(error)}
            />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary sm:w-32">
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Search size={15} aria-hidden />}
            {busy ? 'Searching' : 'Find'}
          </button>
        </div>
        {error && <p className="mt-2 flex items-start gap-1.5 text-[12px] text-danger" role="alert"><TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> {error}</p>}
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-muted">
          <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden />
          Use the number you gave at booking. We never show your full address or report here.
        </p>
      </form>

      {result && (
        <div className="mt-5">
          {result.bookings.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-[13px] font-semibold text-ink">No bookings found for {result.phone}</p>
              <p className="mt-1 text-[12px] text-muted">Check the number, or book a test and we will save it here.</p>
              <Link href="/book" className="btn btn-primary btn-sm mt-3">Book a test</Link>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-muted">
                {result.bookings.length} booking{result.bookings.length === 1 ? '' : 's'} for {result.phone}
              </p>
              <ul className="space-y-3">
                {result.bookings.map((booking) => (
                  <li key={booking.reference} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <b className="text-[13.5px] font-bold text-ink">{booking.reference}</b>
                        <p className="mt-0.5 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden /> {dateLabel(booking.appointmentDate)}</span>
                          <span>· {booking.slotLabel}</span>
                        </p>
                      </div>
                      <span className={STATUS_TONE[booking.status] ?? 'badge badge-gray'}>{booking.statusLabel}</span>
                    </div>

                    <div className="mt-3 flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[12px]">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                        <span>{booking.method === 'home' ? 'Home collection' : 'Lab visit'}</span>
                        <span>· {booking.itemCount} test{booking.itemCount === 1 ? '' : 's'}</span>
                        <span>· ₹{(booking.totalPaise / 100).toLocaleString('en-IN')}</span>
                        {booking.hasReport && <span className="badge badge-green">Report ready</span>}
                      </div>
                      <Link href={`/track?ref=${encodeURIComponent(booking.reference)}&phone=${encodeURIComponent(result.phone)}`} className="inline-flex items-center gap-1 font-semibold text-green hover:underline">
                        View details <ArrowRight size={13} aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
