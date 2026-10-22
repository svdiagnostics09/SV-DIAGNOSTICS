'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, FileText, Inbox, MapPin, Package, RefreshCw, Stethoscope, TestTube2, Wallet } from 'lucide-react'
import { formatINR, formatIndiaTime } from '@/lib/format'
import { useAdminResource } from '@/components/admin/fetch'
import { formatDate } from '@/components/admin/fetch'
import { EmptyState, ErrorState, StatCard } from '@/components/ui'

interface DashboardData {
  counts: Record<string, number>
  byStatus: Record<string, number>
  recentBookings: Array<{ id: string; reference: string; patientName: string; date: string; slot: string; totalPaise: number; status: string; paymentStatus: string; method: string; createdAt: string }>
  recentEnquiries: Array<{ id: string; reference: string; name: string; subject: string; message: string; status: string; createdAt: string }>
  recentAudit: Array<{ id: number; actor: string; action: string; entity: string; at: string }>
  integrations: { email: boolean; whatsapp: boolean; database: string }
  generatedAt: string
}

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending', confirmed: 'Confirmed', collection_scheduled: 'Scheduled', sample_collected: 'Collected',
  processing: 'Processing', report_ready: 'Report ready', completed: 'Completed', cancelled: 'Cancelled',
}

const statusTone = (status: string) => status === 'cancelled' ? 'badge-red' : status === 'completed' || status === 'report_ready' ? 'badge-green' : status === 'pending_confirmation' ? 'badge-amber' : 'badge-teal'

/** Dashboard: every figure is a COUNT from PostgreSQL (no sample data). */
export function DashboardPanel({ initial, onOpen }: { initial: Record<string, unknown> | null; onOpen: (key: string) => void }) {
  const resource = useAdminResource<DashboardData>('/api/admin/dashboard', { pollMs: 20_000 })
  const data = resource.data
  const counts = data?.counts ?? (initial as Record<string, number> | null) ?? {}

  return (
    <div className="space-y-5">
      {resource.error && <div className="card border-[#fecaca] p-3 text-[12.5px] text-danger">Could not load live figures: {resource.error}</div>}

      {!data && resource.loading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="card p-4"><div className="skeleton h-3 w-24" /><div className="skeleton mt-3 h-7 w-16" /></div>)}
        </div>
      )}

      {data && (
        <>
          <section aria-label="Catalogue and operations" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active tests" value={counts.active_tests ?? 0} hint="Published in the catalogue" icon={TestTube2} href="#tests" tone="teal" />
            <StatCard label="Active packages" value={counts.active_packages ?? 0} hint="Published health packages" icon={Package} tone="navy" href="#packages" />
            <StatCard label="Investigations" value={counts.investigations ?? 0} hint="Active investigation names" icon={Stethoscope} tone="violet" href="#investigations" />
            <StatCard label="Active locations" value={counts.active_locations ?? 0} hint="Accepting bookings" icon={MapPin} tone="green" href="#locations" />
            <StatCard label="Total bookings" value={counts.bookings ?? 0} hint="All time" icon={CalendarDays} href="#bookings" />
            <StatCard label="Pending bookings" value={counts.pending_bookings ?? 0} hint="Awaiting confirmation" icon={AlertTriangle} tone="amber" href="#bookings" />
            <StatCard label="Confirmed bookings" value={counts.confirmed_bookings ?? 0} hint="Scheduled and confirmed" icon={CheckCircle2} tone="teal" href="#bookings" />
            <StatCard label="New enquiries" value={counts.new_enquiries ?? 0} hint="Unresolved contact form messages" icon={Inbox} tone="navy" href="#enquiries" />
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Bookings today</p>
              <p className="mt-1 text-[22px] font-bold tabular-nums">{counts.today_bookings ?? 0}</p>
              <p className="text-[11.5px] text-muted">Appointments dated today</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Verified payments collected</p>
              <p className="mt-1 text-[22px] font-bold tabular-nums">{formatINR(Number(counts.collected_paise ?? 0))}</p>
              <p className="text-[11.5px] text-muted">Only bookings marked paid by a verified event</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Bookings by status</p>
              <ul className="mt-1.5 space-y-1 text-[12px]">
                {Object.entries(data.byStatus).filter(([, value]) => value > 0).length === 0 && <li className="text-muted">No bookings yet.</li>}
                {Object.entries(data.byStatus).filter(([, value]) => value > 0).map(([status, value]) => (
                  <li key={status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span aria-hidden className={`size-1.5 rounded-full ${status === 'cancelled' ? 'bg-danger' : status === 'completed' ? 'bg-success' : 'bg-mint'}`} />
                      {STATUS_LABEL[status] ?? status}
                    </span>
                    <b className="tabular-nums">{value}</b>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
            <section className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <h2 className="text-[13.5px] font-bold">Recent bookings</h2>
                  <p className="text-[11px] text-muted">Straight from PostgreSQL · refreshes every 20s</p>
                </div>
                <button type="button" onClick={() => onOpen('bookings')} className="btn btn-outline btn-sm">View all <ChevronRight size={13} aria-hidden /></button>
              </header>
              {data.recentBookings.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No bookings yet" description="Patient bookings appear here the moment they are created. Nothing is pre-filled." />
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentBookings.map((booking) => (
                    <li key={booking.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                      <span className="font-mono text-[11px] font-semibold text-teal-700">{booking.reference}</span>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-[12.5px] font-semibold">{booking.patientName}</b>
                        <span className="text-[11px] text-muted">{formatDate(booking.date)} · {booking.slot} · {booking.method === 'home' ? 'Home' : 'Lab'}</span>
                      </div>
                      <span className="text-[12.5px] font-semibold tabular-nums">{formatINR(booking.totalPaise)}</span>
                      <span className={`badge ${statusTone(booking.status)}`}>{STATUS_LABEL[booking.status] ?? booking.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-[13.5px] font-bold">Recent enquiries</h2>
                <button type="button" onClick={() => onOpen('enquiries')} className="btn btn-outline btn-sm">Open <ChevronRight size={13} aria-hidden /></button>
              </header>
              {data.recentEnquiries.length === 0 ? (
                <EmptyState icon={Inbox} title="No enquiries yet" description="Contact form submissions will appear here." />
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentEnquiries.map((enquiry) => (
                    <li key={enquiry.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate text-[12.5px] font-semibold">{enquiry.name}</b>
                        <span className={`badge ${enquiry.status === 'new' ? 'badge-amber' : 'badge-gray'}`}>{enquiry.status.replace('_', ' ')}</span>
                      </div>
                      <p className="truncate text-[11.5px] text-muted">{enquiry.subject || enquiry.message}</p>
                      <p className="text-[10.5px] text-muted">{formatIndiaTime(enquiry.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <h2 className="text-[13.5px] font-bold">Integration status</h2>
              <ul className="mt-2 space-y-2 text-[12.5px]">
                <li className="flex items-center justify-between gap-2 border-b border-line pb-2">
                  <span className="flex items-center gap-2"><FileText size={14} className="text-teal-700" aria-hidden /> WhatsApp reports</span>
                  <span className={`badge ${data.integrations.whatsapp ? 'badge-green' : 'badge-amber'}`}>{data.integrations.whatsapp ? 'Configured' : 'Not configured'}</span>
                </li>
                <li className="flex items-center justify-between gap-2 border-b border-line pb-2">
                  <span className="flex items-center gap-2"><FileText size={14} className="text-teal-700" aria-hidden /> Email provider</span>
                  <span className={`badge ${data.integrations.email ? 'badge-green' : 'badge-amber'}`}>{data.integrations.email ? 'Configured' : 'Not configured'}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><RefreshCw size={14} className="text-teal-700" aria-hidden /> PostgreSQL</span>
                  <span className="badge badge-green">{data.integrations.database}</span>
                </li>
              </ul>
              <p className="mt-3 text-[11px] leading-5 text-muted">Payments are only marked paid after a signature-verified event. Missing credentials are never simulated.</p>
            </section>

            <section className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-[13.5px] font-bold">Audit trail</h2>
                <button type="button" onClick={() => onOpen('audit')} className="text-[12px] font-semibold text-teal-700 hover:underline">Open log</button>
              </header>
              {data.recentAudit.length === 0 ? (
                <p className="p-4 text-[12.5px] text-muted">No actions recorded yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentAudit.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-2 px-4 py-2">
                      <span className="truncate text-[12px]"><b className="font-medium">{entry.action}</b> · {entry.actor}</span>
                      <span className="shrink-0 text-[10.5px] text-muted">{formatIndiaTime(entry.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {resource.error && !data && <div className="card"><ErrorState title="Dashboard unavailable" description={resource.error} onRetry={resource.reload} /></div>}
    </div>
  )
}

function ShieldCog() {
  return <AlertTriangle size={14} className="text-teal-700" aria-hidden />
}

export function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer) }, [])
  return now
}
