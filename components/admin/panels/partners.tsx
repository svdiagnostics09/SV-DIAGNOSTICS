'use client'

import { useRef, useState } from 'react'
import { Eye, EyeOff, Handshake, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import type { Partner } from '@/lib/partners'

/**
 * Admin → Partners.
 *
 * Each row is one card in the homepage marquee: an uploaded image, a name and
 * an optional role/href. Images upload straight from the browser and are
 * stored in Postgres, served back from /api/partners/<id>.
 */
export function PartnersPanel({ onToast }: { onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const resource = useAdminResource<Partner[]>('/api/admin/partners')
  const [busy, setBusy] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', role: '', href: '' })
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const create = async () => {
    if (draft.name.trim().length < 2) { onToast('Enter the partner name (at least 2 characters).', 'error'); return }
    setBusy('create')
    const result = await adminFetch<{ id: string }>('/api/admin/partners', { method: 'POST', body: draft })
    setBusy(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    setDraft({ name: '', role: '', href: '' })
    onToast(`${draft.name} added. Upload a logo to finish.`)
    resource.reload()
  }

  const patch = async (id: string, body: Record<string, unknown>, message: string) => {
    setBusy(id)
    const result = await adminFetch(`/api/admin/partners?id=${id}`, { method: 'PATCH', body })
    setBusy(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(message)
    resource.reload()
  }

  const upload = async (id: string, file: File | undefined) => {
    if (!file) return
    setBusy(`upload:${id}`)
    const body = new FormData()
    body.append('id', id)
    body.append('file', file)
    const result = await adminFetch('/api/admin/partners/logo', { method: 'POST', formData: body })
    setBusy(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast('Logo uploaded.')
    resource.reload()
  }

  const remove = async (partner: Partner) => {
    if (!window.confirm(`Remove ${partner.name} and its logo?`)) return
    setBusy(partner.id)
    const result = await adminFetch(`/api/admin/partners?id=${partner.id}`, { method: 'DELETE' })
    setBusy(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(`${partner.name} removed.`)
    resource.reload()
  }

  const partners = resource.data ?? []

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden p-0">
        <div className="border-b border-line-soft bg-surface px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 text-[13.5px] font-bold"><Handshake size={15} className="text-green" aria-hidden /> Add a partner</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">They appear in the scrolling “Our partners” band on the homepage. PNG, JPG, WebP or SVG up to 1.5 MB; square logos look best.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end sm:p-5">
          <label className="text-[12px]">
            <span className="mb-1 block font-semibold text-forest">Name</span>
            <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Apollo Hospitals" maxLength={80} />
          </label>
          <label className="text-[12px]">
            <span className="mb-1 block font-semibold text-forest">Role (optional)</span>
            <input className="input" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} placeholder="Hospital partner" maxLength={60} />
          </label>
          <label className="text-[12px]">
            <span className="mb-1 block font-semibold text-forest">Link (optional)</span>
            <input className="input" value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} placeholder="https://…" maxLength={300} />
          </label>
          <button type="button" onClick={create} disabled={busy === 'create'} className="btn btn-primary sm:mb-0.5">
            {busy === 'create' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />} Add
          </button>
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line-soft bg-surface px-4 py-3 sm:px-5">
          <h2 className="text-[13.5px] font-bold">Partners ({partners.length})</h2>
          {resource.refreshing && <Loader2 size={14} className="animate-spin text-muted" aria-hidden />}
        </div>

        {resource.error && <p className="p-4 text-[12.5px] text-danger">{resource.error}</p>}
        {resource.loading && <p className="p-4 text-[12.5px] text-muted"><Loader2 className="inline animate-spin" size={14} aria-hidden /> Loading partners…</p>}
        {!resource.loading && partners.length === 0 && (
          <p className="p-4 text-[12.5px] text-muted">No partners yet. Add one above — the section stays hidden on the site until you do.</p>
        )}

        <ul className="divide-y divide-line-soft">
          {partners.map((partner) => {
            const uploadBusy = busy === `upload:${partner.id}`
            return (
              <li key={partner.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:px-5">
                <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border-line bg-surface text-[13px] font-extrabold text-forest">
                  {partner.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin preview of a user upload
                    <img src={partner.logoUrl} alt={`${partner.name} logo`} className="size-full object-contain p-1" />
                  ) : (
                    partner.name.slice(0, 2).toUpperCase()
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <b className={`block truncate text-[13px] font-semibold ${partner.isActive ? 'text-ink' : 'text-muted line-through'}`}>{partner.name}</b>
                  <span className="block truncate text-[11.5px] text-muted">{partner.role || 'No role set'}{partner.href ? ' · linked' : ''}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    ref={(node) => { inputs.current[partner.id] = node }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(event) => { void upload(partner.id, event.target.files?.[0]); event.target.value = '' }}
                  />
                  <button type="button" onClick={() => inputs.current[partner.id]?.click()} disabled={uploadBusy} className="btn btn-outline btn-sm">
                    {uploadBusy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Upload size={13} aria-hidden />} {partner.logoUrl ? 'Replace' : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(partner.id, { isActive: !partner.isActive }, partner.isActive ? `${partner.name} hidden from the site.` : `${partner.name} shown on the site.`)}
                    disabled={busy === partner.id}
                    className="btn btn-ghost btn-sm"
                    aria-label={partner.isActive ? `Hide ${partner.name}` : `Show ${partner.name}`}
                  >
                    {partner.isActive ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
                  </button>
                  <button type="button" onClick={() => remove(partner)} disabled={busy === partner.id} className="btn btn-danger btn-sm" aria-label={`Delete ${partner.name}`}>
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
