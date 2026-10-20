'use client'

import { useMemo, useState } from 'react'
import { Inbox, Search } from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import { formatIndiaTime } from '@/lib/format'
import { EmptyState } from '@/components/ui'

interface EnquiryRow { id: string; reference: string; name: string; phone: string; email: string; subject: string; message: string; status: string; internalNote: string; createdAt: string }

const STATUSES = ['new', 'in_progress', 'resolved', 'archived'] as const
const LABEL: Record<string, string> = { new: 'New', in_progress: 'In progress', resolved: 'Resolved', archived: 'Archived' }
const tone = (status: string) => status === 'new' ? 'badge-amber' : status === 'resolved' ? 'badge-green' : 'badge-gray'

export function EnquiriesPanel({ onToast }: { onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const resource = useAdminResource<{ enquiries: EnquiryRow[] }>('/api/admin/bookings?view=enquiries', { pollMs: 30_000 })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const rows = useMemo(() => (resource.data?.enquiries ?? []).filter((row) =>
    (status === 'all' || row.status === status)
    && (!query || `${row.name} ${row.phone} ${row.subject} ${row.message} ${row.reference}`.toLowerCase().includes(query.toLowerCase())),
  ), [resource.data, query, status])

  const update = async (row: EnquiryRow, body: Record<string, unknown>, message: string) => {
    const result = await adminFetch(`/api/admin/enquiries/${row.id}`, { method: 'PATCH', body })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(message); resource.reload()
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="enquiry-search" className="sr-only">Search enquiries</label>
          <input id="enquiry-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, phone, subject or message" className="input pl-9" />
        </div>
        <label htmlFor="enquiry-status" className="sr-only">Status</label>
        <select id="enquiry-status" value={status} onChange={(event) => setStatus(event.target.value)} className="input w-auto">
          <option value="all">All statuses</option>
          {STATUSES.map((value) => <option key={value} value={value}>{LABEL[value]}</option>)}
        </select>
      </div>

      {resource.error && <div className="card p-4 text-[12.5px] text-danger">{resource.error}</div>}

      <div className="card overflow-hidden">
        {resource.loading && <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-12 w-full" />)}</div>}
        {!resource.loading && rows.length === 0 && <EmptyState icon={Inbox} title="No enquiries match" description="Contact form submissions are stored here with their full message." />}
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => { setOpen(open === row.id ? null : row.id); setNote(row.internalNote) }} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-page/60" aria-expanded={open === row.id}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate text-[13px] font-semibold">{row.name}</b><span className={`badge ${tone(row.status)}`}>{LABEL[row.status] ?? row.status}</span></span>
                  <span className="block truncate text-[11.5px] text-muted">{row.subject || 'No subject'} · {row.phone}{row.email ? ` · ${row.email}` : ''}</span>
                </span>
                <span className="text-[10.5px] text-muted">{formatIndiaTime(row.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </button>
              {open === row.id && (
                <div className="border-t border-line bg-page/40 px-4 py-3">
                  <p className="whitespace-pre-line text-[13px] leading-6">{row.message}</p>
                  <p className="mt-1 text-[10.5px] text-muted">Reference {row.reference}</p>
                  <label htmlFor={`enq-note-${row.id}`} className="label mt-3">Internal note</label>
                  <textarea id={`enq-note-${row.id}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="input" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => update(row, { internalNote: note }, 'Note saved.')} className="btn btn-outline btn-sm">Save note</button>
                    {STATUSES.filter((value) => value !== row.status).map((value) => (
                      <button key={value} type="button" onClick={() => update(row, { status: value }, `Marked ${LABEL[value].toLowerCase()}.`)} className="btn btn-ghost btn-sm">{LABEL[value]}</button>
                    ))}
                    <a href={`tel:${row.phone}`} className="btn btn-ghost btn-sm">Call {row.phone}</a>
                    {row.email && <a href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: ${row.subject || 'Your enquiry'} (${row.reference})`)}`} className="btn btn-ghost btn-sm">Reply by email</a>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
