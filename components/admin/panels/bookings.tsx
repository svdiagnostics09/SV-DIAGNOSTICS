'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Mail, MessageSquare, RefreshCw, Search, X, XCircle } from 'lucide-react'
import { adminFetch, formatDate, useAdminResource } from '@/components/admin/fetch'
import { formatINR, formatIndiaTime } from '@/lib/format'
import { EmptyState } from '@/components/ui'

interface BookingRow {
  id: string; reference: string; patientName: string; phone: string; email: string | null; method: string; locationName: string | null
  appointmentDate: string; slotLabel: string; totalPaise: number; paymentMethod: string; paymentStatus: string; status: string; statusLabel: string; createdAt: string
  items: Array<{ name: string; quantity: number; unitPricePaise: number }>
}

interface ListResponse { bookings: BookingRow[]; total: number; page: number; pages: number; statuses: string[] }

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending', confirmed: 'Confirmed', collection_scheduled: 'Scheduled', sample_collected: 'Collected',
  processing: 'Processing', report_ready: 'Report ready', completed: 'Completed', cancelled: 'Cancelled',
}

const NEXT_ACTIONS: Record<string, string[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['collection_scheduled', 'cancelled'],
  collection_scheduled: ['sample_collected', 'cancelled'],
  sample_collected: ['processing'],
  processing: ['report_ready'],
  report_ready: ['completed'],
  completed: [],
  cancelled: [],
}

const tone = (status: string) => status === 'cancelled' ? 'badge-red' : status === 'completed' || status === 'report_ready' ? 'badge-green' : status === 'pending_confirmation' ? 'badge-amber' : 'badge-teal'

/** Server-paginated booking table with filters and a detail drawer. */
export function BookingsPanel({ initial, onToast }: { initial: unknown; onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const [data, setData] = useState<ListResponse | null>(initial as ListResponse)
  const [loading, setLoading] = useState(!initial)
  const [filters, setFilters] = useState({ q: '', status: 'all', method: 'all', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (filters.q) params.set('q', filters.q)
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.method !== 'all') params.set('method', filters.method)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const result = await adminFetch<ListResponse>(`/api/admin/bookings?${params}`)
    setLoading(false)
    if (!result.ok) { onToast(result.error, 'error'); return }
    setData(result.data)
  }, [filters, page, onToast])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, filters.q ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, filters.q])

  // Poll so new bookings and staff changes appear without a manual refresh.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000)
    return () => clearInterval(timer)
  }, [load])

  const setFilter = (key: keyof typeof filters, value: string) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })) }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="booking-search" className="sr-only">Search bookings</label>
          <input id="booking-search" value={filters.q} onChange={(event) => setFilter('q', event.target.value)} placeholder="Reference, patient, phone or email" className="input pl-9" />
        </div>
        <label htmlFor="booking-status" className="sr-only">Status</label>
        <select id="booking-status" value={filters.status} onChange={(event) => setFilter('status', event.target.value)} className="input w-auto">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="booking-method" className="sr-only">Collection method</label>
        <select id="booking-method" value={filters.method} onChange={(event) => setFilter('method', event.target.value)} className="input w-auto">
          <option value="all">Home & lab</option>
          <option value="home">Home collection</option>
          <option value="lab">Laboratory visit</option>
        </select>
        <label htmlFor="booking-from" className="sr-only">From date</label>
        <input id="booking-from" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} className="input w-auto" />
        <label htmlFor="booking-to" className="sr-only">To date</label>
        <input id="booking-to" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} className="input w-auto" />
        <button type="button" onClick={load} className="btn btn-outline btn-sm" aria-label="Refresh"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden /></button>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Reference</th>
                <th scope="col" className="px-3 py-2 font-semibold">Patient</th>
                <th scope="col" className="px-3 py-2 font-semibold">Appointment</th>
                <th scope="col" className="px-3 py-2 font-semibold">Items</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
                <th scope="col" className="px-3 py-2 font-semibold">Payment</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && !data && Array.from({ length: 6 }, (_, index) => <tr key={index}><td colSpan={7} className="px-3 py-3"><div className="skeleton h-4 w-full" /></td></tr>)}
              {data?.bookings.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={CalendarDays} title={filters.q || filters.status !== 'all' ? 'No bookings match these filters' : 'No bookings yet'} description={filters.q || filters.status !== 'all' ? 'Try a different reference, patient name or status.' : 'Bookings made on the website appear here immediately.'} /></td></tr>
              )}
              {data?.bookings.map((booking) => (
                <tr key={booking.id} className="cursor-pointer hover:bg-page/60" onClick={() => setOpen(booking.id)}>
                  <td className="px-3 py-2.5">
                    <button type="button" className="font-mono text-[11px] font-semibold text-teal-700 hover:underline" onClick={(event) => { event.stopPropagation(); setOpen(booking.id) }}>{booking.reference}</button>
                    <span className="block text-[10px] text-muted">{formatIndiaTime(booking.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <b className="block font-semibold">{booking.patientName}</b>
                    <span className="text-[10.5px] text-muted">{booking.phone}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block">{formatDate(booking.appointmentDate)}</span>
                    <span className="text-[10.5px] text-muted">{booking.slotLabel} · {booking.method === 'home' ? 'Home' : booking.locationName ?? 'Lab'}</span>
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5"><span className="line-clamp-2 text-muted">{booking.items.map((item) => item.name).join(', ') || '—'}</span></td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatINR(booking.totalPaise)}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${booking.paymentStatus === 'paid' ? 'badge-green' : booking.paymentStatus === 'refunded' ? 'badge-gray' : booking.paymentStatus === 'failed' ? 'badge-red' : 'badge-amber'}`}>{booking.paymentStatus}</span></td>
                  <td className="px-3 py-2.5"><span className={`badge ${tone(booking.status)}`}>{booking.statusLabel ?? STATUS_LABEL[booking.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12px]">
            <span className="text-muted">{data.total} bookings · page {data.page} of {data.pages}</span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="btn btn-outline btn-sm"><ChevronLeft size={13} aria-hidden /> Prev</button>
              <button type="button" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)} className="btn btn-outline btn-sm">Next <ChevronRight size={13} aria-hidden /></button>
            </div>
          </div>
        )}
      </div>

      {open && <BookingDrawer id={open} onClose={() => setOpen(null)} onChanged={() => { void load(); onToast('Booking updated.') }} onToast={onToast} />}
    </div>
  )
}

interface BookingItem { kind: string; name: string; unitPricePaise: number; quantity: number }

interface Detail {
  booking: BookingRow & { age: number | null; gender: string | null; addressLine: string; addressArea: string; pincode: string; areaName: string | null; subtotalPaise: number; discountPaise: number; collectionFeePaise: number; internalNotes: string; cancellationReason: string; consentAccepted: boolean; updatedAt: string }
  /** Line items are returned alongside the booking, not nested inside it. */
  items: BookingItem[]
  events: Array<{ kind: string; message: string; actor: string; at: string }>
  notifications: Array<{ channel: string; recipient: string; template: string; status: string; detail: string; at: string }>
  consents: Array<{ type: string; version: string; accepted: boolean; at: string }>
}

function BookingDrawer({ id, onClose, onChanged, onToast }: { id: string; onClose: () => void; onChanged: () => void; onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await adminFetch<Detail>(`/api/admin/bookings/${id}`)
    if (!result.ok) { setError(result.error); return }
    setDetail(result.data)
    setNote(result.data.booking.internalNotes)
  }, [id])

  useEffect(() => { void load() }, [load])

  const act = async (body: Record<string, unknown>, message: string) => {
    setBusy(true)
    const result = await adminFetch('/api/admin/bookings', { method: 'PATCH', body: { id, ...body } })
    setBusy(false)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(message)
    await load()
    onChanged()
  }

  const cancelBooking = () => {
    const reason = window.prompt('Cancellation reason (shown in the audit log):', 'Cancelled by staff')
    if (!reason) return
    void act({ action: 'cancel', reason }, 'Booking cancelled; slot capacity released.')
  }

  const editEmail = async () => {
    const email = window.prompt('Patient email for notifications:', detail?.booking.email ?? '')
    if (email === null) return
    await act({ action: 'email', email }, 'Email updated.')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" role="dialog" aria-modal="true" aria-labelledby="booking-drawer-title">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            {detail ? (
              <>
                <p className="font-mono text-[11.5px] font-semibold text-teal-700">{detail.booking.reference}</p>
                <h2 id="booking-drawer-title" className="text-[16px] font-bold">{detail.booking.patientName}</h2>
                <p className="text-[11.5px] text-muted">{detail.booking.phone}{detail.booking.email ? ` · ${detail.booking.email}` : ''}</p>
              </>
            ) : <h2 id="booking-drawer-title" className="text-[16px] font-bold">Booking</h2>}
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted hover:bg-page" aria-label="Close"><X size={17} aria-hidden /></button>
        </header>

        {error && <p className="px-5 py-3 text-[12.5px] text-danger">{error}</p>}
        {!detail && !error && <div className="p-5"><Loader2 className="animate-spin text-muted" size={18} aria-hidden /></div>}
        {detail && (
          <div className="space-y-5 px-5 py-4">
            <section>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`badge ${tone(detail.booking.status)}`}>{detail.booking.statusLabel}</span>
                <span className={`badge ${detail.booking.paymentStatus === 'paid' ? 'badge-green' : 'badge-amber'}`}>Payment: {detail.booking.paymentStatus}</span>
                <span className="badge badge-gray">{detail.booking.paymentMethod.replace('_', ' ')}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
                <div><dt className="text-muted">Appointment</dt><dd className="font-medium">{formatDate(detail.booking.appointmentDate)} · {detail.booking.slotLabel}</dd></div>
                <div><dt className="text-muted">Collection</dt><dd className="font-medium">{detail.booking.method === 'home' ? 'Home collection' : detail.booking.locationName ?? 'Laboratory'}</dd></div>
                {detail.booking.method === 'home' && <div className="col-span-2"><dt className="text-muted">Address</dt><dd className="font-medium">{detail.booking.addressLine}{detail.booking.addressArea ? `, ${detail.booking.addressArea}` : ''} · {detail.booking.pincode}{detail.booking.areaName ? ` (${detail.booking.areaName})` : ''}</dd></div>}
                {detail.booking.age !== null && <div><dt className="text-muted">Age / gender</dt><dd>{detail.booking.age ?? '—'} · {detail.booking.gender ?? '—'}</dd></div>}
                <div><dt className="text-muted">Consent</dt><dd>{detail.booking.consentAccepted ? 'Accepted' : 'Missing'}{detail.consents[0] ? ` · v${detail.consents[0].version}` : ''}</dd></div>
              </dl>
            </section>

            <section>
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted">Tests &amp; amounts</h3>
              <ul className="mt-1.5 divide-y divide-line text-[12.5px]">
                {(detail.items ?? []).map((item) => <li key={`${item.kind}-${item.name}`} className="flex justify-between gap-2 py-1.5"><span>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span><span className="tabular-nums">{formatINR(item.unitPricePaise * item.quantity)}</span></li>)}
                {(detail.items ?? []).length === 0 && <li className="py-1.5 text-muted">No line items recorded for this booking.</li>}
              </ul>
              <dl className="mt-1 space-y-0.5 border-t border-line pt-1.5 text-[12.5px]">
                {detail.booking.discountPaise > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="text-success">− {formatINR(detail.booking.discountPaise)}</dd></div>}
                {detail.booking.collectionFeePaise > 0 && <div className="flex justify-between"><dt className="text-muted">Home collection</dt><dd>{formatINR(detail.booking.collectionFeePaise)}</dd></div>}
                <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{formatINR(detail.booking.totalPaise)}</dd></div>
              </dl>
            </section>

            <section>
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted">Update status</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(NEXT_ACTIONS[detail.booking.status] ?? []).filter((next) => next !== 'cancelled').map((next) => (
                  <button key={next} type="button" disabled={busy} onClick={() => act({ action: 'status', status: next }, `Status set to ${STATUS_LABEL[next]}.`)} className="btn btn-outline btn-sm">
                    <CheckCircle2 size={13} aria-hidden /> {STATUS_LABEL[next]}
                  </button>
                ))}
                {NEXT_ACTIONS[detail.booking.status]?.includes('cancelled') && (
                  <button type="button" disabled={busy} onClick={cancelBooking} className="btn btn-danger btn-sm"><XCircle size={13} aria-hidden /> Cancel booking</button>
                )}
                {(NEXT_ACTIONS[detail.booking.status] ?? []).length === 0 && <p className="text-[12px] text-muted">This booking is in a final state.</p>}
              </div>
              {detail.booking.status === 'cancelled' && detail.booking.cancellationReason && <p className="mt-2 text-[12px] text-muted">Reason: {detail.booking.cancellationReason}</p>}
            </section>

            <section>
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted">Internal notes (staff only)</h3>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="input mt-1.5" placeholder="Visible only to administrators" />
              <button type="button" disabled={busy} onClick={() => act({ action: 'notes', notes: note }, 'Notes saved.')} className="btn btn-outline btn-sm mt-1.5"><MessageSquare size={13} aria-hidden /> Save note</button>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted">Notifications</h3>
                <button type="button" onClick={editEmail} className="btn btn-ghost btn-sm"><Mail size={13} aria-hidden /> Email</button>
              </div>
              {detail.notifications.length > 0 && (
                <>
                  <h3 className="mt-3 text-[12px] font-bold uppercase tracking-wide text-muted">Notifications</h3>
                  <ul className="mt-1 space-y-1 text-[11.5px]">
                    {detail.notifications.map((notification, index) => (
                      <li key={index} className="flex items-center justify-between gap-2"><span>{notification.channel} · {notification.template}</span><span className={`badge ${notification.status === 'sent' ? 'badge-green' : notification.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>{notification.status}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section>
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted">History</h3>
              <ol className="mt-1.5 space-y-2 border-l border-line pl-3 text-[12px]">
                {detail.events.map((event, index) => (
                  <li key={index}><b className="block font-medium">{event.message}</b><span className="text-muted">{event.actor} · {formatIndiaTime(event.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}
