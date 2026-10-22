'use client'

import { useState } from 'react'
import { ArrowUpRight, CalendarCheck, CheckCircle2, Clock3, FileDown, FileText, Loader2, Search, XCircle } from 'lucide-react'
import type { TrackingResult } from '@/lib/booking'
import { formatINR, formatIndiaTime } from '@/lib/format'

const TIMELINE: Array<{ key: TrackingResult['status']; label: string }> = [
  { key: 'pending_confirmation', label: 'Pending confirmation' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'collection_scheduled', label: 'Sample collection scheduled' },
  { key: 'sample_collected', label: 'Sample collected' },
  { key: 'processing', label: 'Processing' },
  { key: 'report_ready', label: 'Report ready' },
  { key: 'completed', label: 'Completed' },
]

export function TrackBooking({ initialReference, cancellationWindowHours }: { initialReference?: string; cancellationWindowHours: number }) {
  const [reference, setReference] = useState(initialReference ?? '')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [error, setError] = useState('')
  const [booking, setBooking] = useState<TrackingResult | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault()
    setState('loading')
    setError('')
    setCancelMessage('')
    const response = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' }, body: JSON.stringify({ reference, phone }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setState('error'); setError(body.error ?? 'We could not retrieve that booking.'); return }
    setBooking(body as TrackingResult)
    setState('found')
  }

  const cancel = async () => {
    if (!booking) return
    const reason = window.prompt('Reason for cancellation (optional)') ?? ''
    setCancelling(true)
    const response = await fetch('/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' }, body: JSON.stringify({ reference: booking.reference, phone, reason }) })
    const body = await response.json().catch(() => ({}))
    setCancelling(false)
    if (!response.ok) { setCancelMessage(body.error ?? 'The booking could not be cancelled.'); return }
    setCancelMessage('Your booking has been cancelled and the slot has been released.')
    const refreshed = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' }, body: JSON.stringify({ reference: booking.reference, phone }) })
    if (refreshed.ok) setBooking(await refreshed.json() as TrackingResult)
  }

  const currentIndex = booking ? TIMELINE.findIndex((step) => step.key === booking.status) : -1
  const canCancel = booking ? ['pending_confirmation', 'confirmed'].includes(booking.status) : false

  return (
    <div className="space-y-5">
      <form onSubmit={lookup} className="card p-6">
        <h2 className="text-[17px] font-bold">Find your booking</h2>
        <p className="mt-1 text-[13px] text-muted">Enter the reference from your confirmation and the mobile number used for the booking.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="track-ref" className="label">Booking reference</label>
            <input id="track-ref" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="SV-2026-AB12CD" className="input font-mono uppercase" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="track-phone" className="label">Registered mobile number</label>
            <input id="track-phone" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d+]/g, ''))} inputMode="tel" placeholder="98765 43210" className="input" autoComplete="tel" aria-describedby="track-phone-hint" />
            <p id="track-phone-hint" className="mt-1 text-[11px] text-muted">Used only to verify you. Never shown publicly.</p>
          </div>
        </div>
        {state === 'error' && <p role="alert" className="mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12.5px] text-danger">{error}</p>}
        <button type="submit" disabled={state === 'loading' || !reference || !phone} className="btn btn-primary mt-4">
          {state === 'loading' ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Checking…</> : <><Search size={15} aria-hidden /> Find booking</>}
        </button>
      </form>

      {state === 'found' && booking && (
        <section className="card overflow-hidden" aria-live="polite">
          <div className="flex flex-col justify-between gap-3 border-b border-line bg-page p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[12px] font-semibold text-teal-700">{booking.reference}</p>
              <h2 className="mt-0.5 text-[18px] font-bold">{booking.statusLabel}</h2>
              <p className="text-[12.5px] text-muted">{formatIndiaTime(`${booking.appointmentDate}T12:00:00+05:30`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {booking.slotLabel}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted">Total</p>
              <b className="text-[18px] tabular-nums">{formatINR(booking.totalPaise)}</b>
              <p className="text-[11.5px] capitalize text-muted">Payment: {booking.paymentStatus} ({booking.paymentMethod.replace('_', ' ')})</p>
            </div>
          </div>

          {booking.report && (
            <div className="flex flex-col gap-3 border-b border-line bg-mint-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-mint-700"><FileDown size={17} aria-hidden /></span>
                <div className="min-w-0">
                  <b className="block text-[13px] font-semibold text-forest">Your report is ready</b>
                  <span className="block truncate text-[11.5px] text-muted">{booking.report.fileName} · uploaded {formatIndiaTime(booking.report.uploadedAt, { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
              <a href={booking.report.downloadUrl} className="btn btn-primary btn-sm shrink-0" target="_blank" rel="noopener noreferrer">
                <FileDown size={14} aria-hidden /> Download PDF <ArrowUpRight size={13} aria-hidden />
              </a>
            </div>
          )}

          <div className="p-5">
            {booking.status === 'cancelled' ? (
              <p className="flex items-center gap-2 rounded-lg bg-[#fef2f2] p-3 text-[13px] text-danger"><XCircle size={16} aria-hidden /> This booking has been cancelled.</p>
            ) : (
              <ol className="grid gap-2 sm:grid-cols-4">
                {TIMELINE.map((step, index) => {
                  const done = index <= currentIndex
                  const active = index === currentIndex
                  return (
                    <li key={step.key} className={`rounded-lg border p-2.5 ${active ? 'border-teal bg-teal-50' : done ? 'border-line bg-page' : 'border-dashed border-line'}`}>
                      <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${done ? 'bg-teal text-white' : 'bg-[#e8eef8] text-muted'}`}>{done ? <CheckCircle2 size={12} aria-hidden /> : index + 1}</span>
                      <span className={`mt-1.5 block text-[11.5px] font-semibold leading-tight ${done ? 'text-navy' : 'text-muted'}`}>{step.label}</span>
                    </li>
                  )
                })}
              </ol>
            )}

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted"><FileText size={13} aria-hidden /> Tests</h3>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {booking.items.map((item) => <li key={item.name} className="flex justify-between gap-2"><span>{item.name}</span><span className="tabular-nums text-muted">{formatINR(item.unitPricePaise * item.quantity)}</span></li>)}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted"><Clock3 size={13} aria-hidden /> Updates</h3>
                <ol className="mt-2 space-y-2 border-l border-line pl-3 text-[12px]">
                  {booking.timeline.map((event, index) => (
                    <li key={`${event.at}-${index}`}>
                      <b className="block font-medium text-ink">{event.message}</b>
                      <span className="text-muted">{formatIndiaTime(event.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {canCancel && (
              <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-muted"><CalendarCheck size={13} className="mr-1 inline" aria-hidden /> Online cancellation is available up to {cancellationWindowHours} hours before the appointment.</p>
                <button type="button" onClick={cancel} disabled={cancelling} className="btn btn-danger btn-sm">{cancelling ? 'Cancelling…' : 'Cancel booking'}</button>
              </div>
            )}
            {cancelMessage && <p className="mt-3 rounded-lg bg-page px-3 py-2 text-[12.5px]" role="status">{cancelMessage}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
