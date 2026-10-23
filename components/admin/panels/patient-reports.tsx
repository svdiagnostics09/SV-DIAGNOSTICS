'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Upload,
} from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import { formatIndiaTime } from '@/lib/format'
import { EmptyState } from '@/components/ui'

interface ReportRow {
  bookingId: string
  reference: string
  patientName: string
  phone: string
  appointmentDate: string
  bookingStatus: string
  method: string
  versions: number
  report: {
    id: string
    fileName: string
    sizeBytes: number
    createdAt: string
    lastDelivery: { status: string; createdAt: string; recipient: string } | null
  } | null
}

interface ListData {
  reports: ReportRow[]
  counts: { uploaded: number; delivered: number; ready_bookings: number }
  whatsapp: { configured: boolean; templates: Record<string, string> }
}

interface DetailData {
  reference: string
  bookedPhone: string
  reports: Array<{ id: string; fileName: string; sizeBytes: number; createdAt: string; revokedAt: string | null; uploadedBy: string }>
  deliveries: Array<{ id: string; status: 'sent' | 'failed' | 'skipped'; recipient: string; detail: string; providerMessageId: string | null; actor: string; createdAt: string }>
  whatsappConfigured: boolean
}
const MAX_BYTES = 20 * 1024 * 1024

/**
 * Build a wa.me link for an Indian mobile number. Returns null when the number
 * cannot be turned into country code + digits. wa.me works on phones (opens the
 * app) and on desktop (opens WhatsApp Web), so the administrator sends the PDF
 * from their own WhatsApp — the server never messages anyone.
 */
function whatsappChatUrl(phone: string, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  const withCountry = /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : /^91[6-9]\d{9}$/.test(digits) ? digits : /^\d{10,15}$/.test(digits) ? digits : null
  if (!withCountry) return null
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`
}

function openWhatsappChat(phone: string, text: string): boolean {
  const url = whatsappChatUrl(phone, text)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending', confirmed: 'Confirmed', collection_scheduled: 'Scheduled', sample_collected: 'Collected',
  processing: 'Processing', report_ready: 'Report ready', completed: 'Completed', cancelled: 'Cancelled',
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

const bookingTone = (status: string) => status === 'report_ready' || status === 'completed' ? 'badge-green' : status === 'cancelled' ? 'badge-red' : status === 'pending_confirmation' ? 'badge-amber' : 'badge-teal'

/**
 * Patient Reports — upload a PDF for a booking and hand it to the patient on
 * WhatsApp. Every action is explicit: uploading never messages anyone, and
 * sending never changes the file.
 */
export function PatientReportsPanel({ onToast }: { onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const target = useRef<ReportRow | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams({ filter })
    if (q.trim()) params.set('q', q.trim())
    return `/api/admin/reports/patients?${params}`
  }, [q, filter])

  const resource = useAdminResource<ListData>(url)
  const data = resource.data

  // Searching re-runs the resource hook (url changes); debounce keystrokes.
  const [search, setSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQ(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const pickFile = (row: ReportRow, input: HTMLInputElement) => {
    target.current = row
    input.value = ''
    input.click()
  }

  const upload = async (file: File | undefined) => {
    const row = target.current
    if (!file || !row) return
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      onToast('Upload the report as a PDF file.', 'error')
      return
    }
    if (file.size > MAX_BYTES) {
      onToast('That file is larger than 20 MB. Compress it and try again.', 'error')
      return
    }
    setUploading(row.bookingId)
    const form = new FormData()
    form.append('bookingId', row.bookingId)
    form.append('file', file)
    const result = await adminFetch<{ fileName: string }>('/api/admin/reports/patients?action=upload', { method: 'POST', formData: form })
    setUploading(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(`Report uploaded for ${row.reference}. Now send it on WhatsApp.`)
    resource.reload()
  }

  const sendApi = async (row: ReportRow) => {
    if (!row.report) { onToast('Upload the PDF first.', 'error'); return }
    setSending(row.bookingId)
    // Sends the branded PDF (logo cover + report) directly through the WhatsApp
    // Cloud API, so no attachment step is needed.
    const result = await adminFetch<{ detail: string; recipient: string; branded: boolean }>(
      '/api/admin/reports/patients?action=send',
      { method: 'POST', body: { bookingId: row.bookingId } },
    )
    setSending(null)
    if (!result.ok) { onToast(result.error, 'error'); resource.reload(); return }
    onToast(result.data.branded
      ? `Sent to ${result.data.recipient} with the branded logo cover.`
      : `Sent to ${result.data.recipient}. Add a PNG/JPG logo to brand the cover.`)
    resource.reload()
  }

  const sendManual = async (row: ReportRow) => {
    if (!row.report) { onToast('Upload the PDF first.', 'error'); return }
    // Opens WhatsApp (app on mobile, WhatsApp Web on desktop) on the patient's
    // chat. Nothing is sent by us: the administrator attaches the PDF and
    // presses send themselves. The attempt is logged so the console shows it.
    const opened = openWhatsappChat(row.phone, `Hello ${row.patientName}, your ${row.report.fileName} report for booking ${row.reference} is ready. Please find the PDF attached.`)
    if (!opened) { onToast('The booking has no usable mobile number for WhatsApp.', 'error'); return }
    setSending(row.bookingId)
    await adminFetch('/api/admin/reports/patients?action=opened', { method: 'POST', body: { bookingId: row.bookingId } }).catch(() => undefined)
    setSending(null)
    onToast(`WhatsApp opened for ${row.patientName}. Attach the PDF and press send.`)
    resource.reload()
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => { void upload(event.target.files?.[0]) }}
      />

      <section className="card flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-2.5">
          <Send size={18} className="mt-0.5 text-mint-700" aria-hidden />
          <div>
            <h2 className="text-[13.5px] font-bold">WhatsApp delivery</h2>
            <p className="max-w-2xl text-[12px] text-muted">
              Upload a PDF, then choose <b>Send branded</b> to deliver the PDF with your logo on the cover through the WhatsApp API, or <b>Open WhatsApp</b> to send it by hand. Every attempt is logged here.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Uploaded" value={data?.counts.uploaded ?? 0} />
          <Stat label="Delivered" value={data?.counts.delivered ?? 0} />
          <Stat label="Books ready" value={data?.counts.ready_bookings ?? 0} />
        </div>
      </section>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="report-search" className="sr-only">Search bookings</label>
          <input id="report-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, patient name or phone" className="input pl-9" />
        </div>
        <label htmlFor="report-filter" className="sr-only">Delivery filter</label>
        <select id="report-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="input w-auto">
          <option value="all">All bookings</option>
          <option value="pending">Not yet sent</option>
          <option value="sent">Sent on WhatsApp</option>
        </select>
        <button type="button" onClick={resource.reload} className="btn btn-outline btn-sm" aria-label="Refresh"><RefreshCw size={14} className={resource.loading ? 'animate-spin' : ''} aria-hidden /></button>
      </div>

      {resource.error && <div className="card p-4 text-[12.5px] text-danger">{resource.error}</div>}

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Booking</th>
                <th scope="col" className="px-3 py-2 font-semibold">Patient</th>
                <th scope="col" className="px-3 py-2 font-semibold">Report</th>
                <th scope="col" className="px-3 py-2 font-semibold">Last delivery</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!data && resource.loading && Array.from({ length: 6 }, (_, index) => <tr key={index}><td colSpan={5} className="px-3 py-3"><div className="skeleton h-4 w-full" /></td></tr>)}
              {data?.reports.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={FileText} title="No bookings yet" description="Patient bookings appear here as soon as they are made — upload the PDF when the report is ready." /></td></tr>
              )}
              {data?.reports.map((row) => {
                const delivered = row.report?.lastDelivery?.status === 'sent'
                const busy = uploading === row.bookingId || sending === row.bookingId
                const expanded = open === row.bookingId
                return (
                  <Fragment key={row.bookingId}>
                    <tr className="align-top hover:bg-page/50">
                      <td className="px-3 py-2.5">
                        <span className="block font-mono text-[11px] font-semibold text-teal-700">{row.reference}</span>
                        <span className="block text-[10.5px] text-muted">{formatIndiaTime(`${row.appointmentDate}T12:00:00+05:30`, { day: 'numeric', month: 'short' })} · {row.method === 'home' ? 'Home' : 'Lab'}</span>
                        <span className={`badge mt-1 ${bookingTone(row.bookingStatus)}`}>{STATUS_LABEL[row.bookingStatus] ?? row.bookingStatus}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block font-medium">{row.patientName}</span>
                        <span className="block text-[11px] text-muted">{row.phone}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.report ? (
                          <>
                            <a href={`/api/admin/reports/patients?file=${row.report.id}`} target="_blank" rel="noopener" className="flex items-center gap-1 font-medium text-teal-700 hover:underline">
                              <FileText size={13} aria-hidden /> {row.report.fileName}
                            </a>
                            <span className="block text-[10.5px] text-muted">
                              {kb(row.report.sizeBytes)} · {formatIndiaTime(row.report.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                              {row.versions > 1 ? ` · ${row.versions} versions` : ''}
                            </span>
                          </>
                        ) : <span className="text-muted">No PDF uploaded</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.report?.lastDelivery ? (
                          <>
                            <span className={`badge ${delivered ? 'badge-green' : row.report.lastDelivery.status === 'failed' ? 'badge-red' : 'badge-gray'}`}>{row.report.lastDelivery.status}</span>
                            <span className="mt-1 block text-[10.5px] text-muted">to {row.report.lastDelivery.recipient} · {formatIndiaTime(row.report.lastDelivery.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                          </>
                        ) : <span className="text-muted">Not sent</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button type="button" onClick={() => pickFile(row, fileInput.current!)} disabled={busy} className="btn btn-outline btn-sm">
                            {uploading === row.bookingId ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Upload size={13} aria-hidden />} {row.report ? 'Replace' : 'Upload PDF'}
                          </button>
                          <a href={`/api/admin/reports/patients?brandedPreview=${row.bookingId}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" title="Preview the branded PDF the patient will receive">Preview</a>
                          <button type="button" onClick={() => sendApi(row)} disabled={busy || !row.report} className="btn btn-primary btn-sm" title={row.report ? 'Send the branded PDF through WhatsApp' : 'Upload a PDF first'}>
                            {sending === row.bookingId ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Send size={13} aria-hidden />} Send branded
                          </button>
                          <button type="button" onClick={() => sendManual(row)} disabled={busy || !row.report} className="btn btn-mint btn-sm" title={row.report ? 'Open the chat and attach the PDF yourself' : 'Upload a PDF first'}>
                            Open WhatsApp
                          </button>
                          <button type="button" onClick={() => setOpen(expanded ? null : row.bookingId)} className="btn btn-ghost btn-sm" aria-expanded={expanded} aria-label="Show report history">
                            <ChevronDown size={14} className={expanded ? 'rotate-180 transition' : 'transition'} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={5} className="bg-surface px-4 py-3">
                          <ReportHistory bookingId={row.bookingId} canSend={Boolean(row.report)} onChanged={resource.reload} onToast={onToast} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11.5px] leading-5 text-muted">
        Only PDFs are accepted (checked by file signature, max 20 MB). Sending happens only when you press a send button, and every attempt is logged.
        Patients cannot download reports from the website.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-page px-3 py-1.5">
      <p className="text-[16px] font-bold leading-tight tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  )
}

/** History drawer: versions of the PDF, revoke action and every WhatsApp attempt. */
function ReportHistory({ bookingId, canSend, onChanged, onToast }: {
  bookingId: string
  canSend: boolean
  onChanged: () => void
  onToast: (text: string, tone?: 'success' | 'error') => void
}) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [phone, setPhone] = useState('')

  const load = useCallback(async () => {
    const result = await adminFetch<DetailData>(`/api/admin/reports/patients?bookingId=${bookingId}`)
      if (!result.ok) { setError(result.error); return }
      setDetail(result.data)
      setPhone((current) => current || result.data.bookedPhone)
    }, [bookingId])
    useEffect(() => { void load() }, [load])

  const uploadNew = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    const form = new FormData()
    form.append('bookingId', bookingId)
    form.append('file', file)
    const result = await adminFetch('/api/admin/reports/patients?action=upload', { method: 'POST', formData: form })
    setBusy(false)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast('Report uploaded.')
    void load()
    onChanged()
  }

  const bookedPhone = detail?.bookedPhone ?? ''

  const resend = async () => {
    if (!detail) return
    const opened = openWhatsappChat(phone.trim() || bookedPhone, `Hello, your report for booking ${detail.reference} is ready. Please find the PDF attached.`)
    if (!opened) { onToast('Enter a mobile number with country code (e.g. 91…).', 'error'); return }
    setBusy(true)
    await adminFetch('/api/admin/reports/patients?action=opened', { method: 'POST', body: { bookingId } }).catch(() => undefined)
    setBusy(false)
    onToast('WhatsApp opened. Attach the PDF and press send.')
    void load()
    onChanged()
  }

  if (error) return <p className="text-[12px] text-danger">{error}</p>
  if (!detail) return <p className="flex items-center gap-2 text-[12px] text-muted"><Loader2 size={13} className="animate-spin" aria-hidden /> Loading history…</p>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted"><FileText size={13} aria-hidden /> Report versions</h3>
        {detail.reports.length === 0 && <p className="text-[12px] text-muted">No PDF has been uploaded for this booking.</p>}
        <ul className="space-y-1.5">
          {detail.reports.map((report) => (
            <li key={report.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-2 text-[11.5px]">
              <span className={`badge ${report.revokedAt ? 'badge-gray' : 'badge-green'}`}>{report.revokedAt ? 'replaced' : 'live'}</span>
              <a href={`/api/admin/reports/patients?file=${report.id}`} target="_blank" rel="noopener" className="font-medium text-teal-700 hover:underline">{report.fileName}</a>
              <span className="flex-1" />
              <span className="text-muted">{kb(report.sizeBytes)} · {formatIndiaTime(report.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · by {report.uploadedBy || 'admin'}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { void uploadNew(event.target.files?.[0]); event.target.value = '' }} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="btn btn-outline btn-sm"><Upload size={13} aria-hidden /> Upload new version</button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted"><Send size={13} aria-hidden /> WhatsApp attempts</h3>
        {detail.deliveries.length === 0 && <p className="text-[12px] text-muted">Nothing has been sent for this booking yet.</p>}
        <ul className="max-h-52 space-y-1.5 overflow-y-auto">
          {detail.deliveries.map((delivery) => (
            <li key={delivery.id} className="rounded-lg border border-line bg-white px-2.5 py-2 text-[11.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${delivery.status === 'sent' ? 'badge-green' : delivery.status === 'failed' ? 'badge-red' : 'badge-gray'}`}>{delivery.status}</span>
                <b className="font-medium">+{delivery.recipient}</b>
                <span className="text-muted">{formatIndiaTime(delivery.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                {delivery.providerMessageId && <span className="font-mono text-[10px] text-muted">{delivery.providerMessageId.slice(0, 18)}…</span>}
              </div>
              <p className="mt-0.5 break-words text-[11px] text-muted">{delivery.detail}</p>
            </li>
          ))}
        </ul>
        {canSend && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d+]/g, ''))} placeholder="Different number (optional)" className="input h-9 w-48 py-0 text-[12px]" inputMode="tel" aria-label="Send to a different mobile number" />
            <button type="button" onClick={resend} disabled={busy} className="btn btn-mint btn-sm">{busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Send size={13} aria-hidden />} Open WhatsApp</button>
          </div>
        )}
      </div>
    </div>
  )
}
