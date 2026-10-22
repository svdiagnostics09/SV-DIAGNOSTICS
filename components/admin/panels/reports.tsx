'use client'

import { ShieldCheck } from 'lucide-react'
import { useAdminResource } from '@/components/admin/fetch'
import { formatINR, formatIndiaTime } from '@/lib/format'
import { EmptyState } from '@/components/ui'

interface ReportsData {
  summary: Record<string, number>
  byStatus: Array<{ status: string; count: number; valuePaise: number }>
  byMethod: Array<{ method: string; count: number }>
  topTests: Array<{ name: string; count: number; revenuePaise: number }>
  daily: Array<{ day: string; count: number; valuePaise: number }>
}

const LABEL: Record<string, string> = {
  pending_confirmation: 'Pending', confirmed: 'Confirmed', collection_scheduled: 'Scheduled', sample_collected: 'Collected',
  processing: 'Processing', report_ready: 'Report ready', completed: 'Completed', cancelled: 'Cancelled',
}

export function ReportsPanel() {
  const resource = useAdminResource<ReportsData>('/api/admin/reports')
  const data = resource.data
  const maxDaily = Math.max(1, ...(data?.daily.map((row) => row.count) ?? [1]))

  return (
    <div className="space-y-5">
      {resource.error && <div className="card p-4 text-[12.5px] text-danger">{resource.error}</div>}
      {!data && resource.loading && <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="card p-4"><div className="skeleton h-4 w-20" /><div className="skeleton mt-3 h-6 w-16" /></div>)}</div>}
      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Bookings', value: data.summary.bookings ?? 0, hint: `${data.summary.cancelled ?? 0} cancelled` },
              { label: 'Active bookings', value: data.summary.active_bookings ?? 0, hint: `${data.summary.today ?? 0} today` },
              { label: 'Booked value', value: formatINR(Number(data.summary.booked_value ?? 0)), hint: 'Excludes cancelled bookings' },
              { label: 'Verified collections', value: formatINR(Number(data.summary.collected_value ?? 0)), hint: `${data.summary.paid_bookings ?? 0} paid bookings` },
            ].map((item) => (
              <div key={item.label} className="card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                <p className="mt-1 text-[22px] font-bold tabular-nums">{item.value}</p>
                <p className="text-[11.5px] text-muted">{item.hint}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <h2 className="text-[13.5px] font-bold">Booking volume · appointment date</h2>
              <div className="mt-3 flex h-36 items-end gap-1">
                {data.daily.length === 0 && <p className="self-center text-[12px] text-muted">No appointments in this window.</p>}
                {data.daily.map((row) => (
                  <div key={row.day} className="group flex flex-1 flex-col items-center gap-1" title={`${row.day}: ${row.count} bookings · ${formatINR(row.valuePaise)}`}>
                    <div className="w-full rounded-t bg-teal/70 transition group-hover:bg-teal" style={{ height: `${Math.max(4, (row.count / maxDaily) * 100)}%` }} />
                    <span className="text-[9px] text-muted">{row.day.slice(8)}/{row.day.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-4">
              <h2 className="text-[13.5px] font-bold">Status breakdown</h2>
              <ul className="mt-2 space-y-1.5 text-[12.5px]">
                {data.byStatus.length === 0 && <li className="text-muted">No bookings yet.</li>}
                {data.byStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between gap-2">
                    <span className="text-muted">{LABEL[row.status] ?? row.status}</span>
                    <span className="flex items-center gap-2"><b className="tabular-nums">{row.count}</b><span className="w-20 text-right tabular-nums text-muted">{formatINR(row.valuePaise)}</span></span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 text-[12px] font-bold uppercase tracking-wide text-muted">Payment method</h3>
              <ul className="mt-1 space-y-1 text-[12.5px]">
                {data.byMethod.map((row) => <li key={row.method} className="flex justify-between"><span className="capitalize text-muted">{row.method.replace('_', ' ')}</span><b className="tabular-nums">{row.count}</b></li>)}
              </ul>
            </section>
          </div>

          <section className="card overflow-hidden">
            <header className="border-b border-line px-4 py-3"><h2 className="text-[13.5px] font-bold">Top booked tests</h2></header>
            <div className="table-wrap">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted"><tr><th scope="col" className="px-3 py-2 font-semibold">Test / package</th><th scope="col" className="px-3 py-2 text-right font-semibold">Bookings</th><th scope="col" className="px-3 py-2 text-right font-semibold">Value</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.topTests.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-muted">Nothing booked yet.</td></tr>}
                  {data.topTests.map((row) => <tr key={row.name}><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2 text-right tabular-nums">{row.count}</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(row.revenuePaise)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export function AuditPanel() {
  const resource = useAdminResource<{ logs: Array<{ id: number; actor: string; action: string; entity: string; entityId: string; detail: Record<string, unknown>; at: string }> }>('/api/admin/bookings?view=audit&limit=200')
  return (
    <div className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3"><ShieldCheck size={16} className="text-teal-700" aria-hidden /><h2 className="text-[13.5px] font-bold">Audit log</h2><span className="text-[11.5px] text-muted">newest first · append-only</span></header>
      {resource.error && <p className="p-4 text-[12.5px] text-danger">{resource.error}</p>}
      <ul className="divide-y divide-line">
        {resource.loading && <li className="p-4"><div className="skeleton h-4 w-full" /></li>}
        {resource.data?.logs.length === 0 && <li><EmptyState icon={ShieldCheck} title="No audit entries yet" description="Sign-ins, test edits, booking changes and settings updates are recorded here." /></li>}
        {resource.data?.logs.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12px]">
            <span className={`badge ${entry.action.includes('failed') ? 'badge-red' : entry.action.includes('delete') || entry.action.includes('cancel') ? 'badge-amber' : 'badge-gray'}`}>{entry.action}</span>
            <span className="font-medium">{entry.entity}{entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ''}</span>
            <span className="text-muted">by {entry.actor || 'system'}</span>
            <span className="ml-auto text-[10.5px] text-muted">{formatIndiaTime(entry.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
