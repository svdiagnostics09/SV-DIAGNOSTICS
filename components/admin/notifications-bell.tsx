'use client'

import Link from 'next/link'
import { Bell, Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'

/**
 * Bell in the admin topbar.
 *
 * Polls every 20s for booking alerts written by notifyStaffEmail() at booking
 * time, so front-desk staff see a new slot without refreshing. The panel lists
 * the most recent alerts; "Mark all read" clears the badge for the whole team.
 */

interface Alert {
  id: string
  text: string
  createdAt: string
  read: boolean
  bookingId: string | null
  reference: string | null
  patientName: string | null
  status: string | null
  totalPaise: number | null
}

interface AlertsResponse {
  items: Alert[]
  unread: number
  hasReadState: boolean
}

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending confirmation',
  confirmed: 'Confirmed',
  collection_scheduled: 'Collection scheduled',
  sample_collected: 'Sample collected',
  processing: 'Processing',
  report_ready: 'Report ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function AdminNotifications() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Poll while the console is open; a booking rarely arrives mid-click.
  const resource = useAdminResource<AlertsResponse>('/api/admin/notifications', { pollMs: 20000 })
  const panelRef = useRef<HTMLDivElement>(null)

  const items = resource.data?.items ?? []
  const unread = resource.data?.unread ?? 0

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markAll = async () => {
    setBusy(true)
    await adminFetch('/api/admin/notifications', { method: 'PATCH', body: {} })
    setBusy(false)
    resource.reload()
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-full border-line bg-white text-forest transition hover:border-green hover:text-green"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[17px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[17px] text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Booking notifications"
          className="animate-in absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-card border-line bg-white shadow-lift"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line-soft bg-surface px-3 py-2.5">
            <b className="text-[12.5px] font-bold text-forest">
              Notifications {unread > 0 && <span className="text-muted">({unread} new)</span>}
            </b>
            <div className="flex items-center gap-1">
              {unread > 0 && resource.data?.hasReadState !== false && (
                <button type="button" onClick={markAll} disabled={busy} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-green transition hover:bg-mint-50">
                  <Check size={12} aria-hidden /> Mark all read
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-line-soft" aria-label="Close notifications">
                <X size={13} aria-hidden />
              </button>
            </div>
          </div>

          {resource.loading && <p className="px-3 py-6 text-center text-[12px] text-muted">Loading…</p>}
          {resource.error && <p className="px-3 py-4 text-[12px] text-danger">{resource.error}</p>}
          {!resource.loading && items.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-muted">No booking alerts yet. New slots will appear here automatically.</p>
          )}

          <ul className="max-h-[380px] divide-y divide-line-soft overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className={item.read ? 'bg-white' : 'bg-mint-50/40'}>
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.read ? 'bg-line' : 'bg-green'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-ink">
                      {item.patientName ?? 'New booking'}
                      {item.reference && <span className="font-normal text-muted"> · {item.reference}</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted">{item.text}</p>
                    <div className="mt-1 flex-wrap items-center gap-x-2 text-[10.5px] text-muted">
                      <span>{relative(item.createdAt)}</span>
                      {item.status && <span>· {STATUS_LABEL[item.status] ?? item.status}</span>}
                      {item.totalPaise != null && <span>· ₹{(item.totalPaise / 100).toLocaleString('en-IN')}</span>}
                    </div>
                    {item.reference && (
                      <Link
                        href={`/admin?panel=bookings`}
                        onClick={() => setOpen(false)}
                        className="mt-1 inline-block text-[11px] font-semibold text-green hover:underline"
                      >
                        Open bookings →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
