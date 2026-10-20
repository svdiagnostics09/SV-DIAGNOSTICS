'use client'

import { useState } from 'react'
import { Archive, Loader2, Package, Pencil, Plus, Trash2, X } from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import { formatINR } from '@/lib/format'
import { EmptyState } from '@/components/ui'

interface AdminPackage {
  id: number; name: string; slug: string; description: string; preparation: string; sampleType: string; turnaroundHours: number | null
  pricePaise: number; originalPricePaise: number | null; homeCollection: boolean; isPopular: boolean; status: string; testCount: number; testsSumPaise: number
}

interface TestOption { id: number; name: string; status: string; listPricePaise: number }

interface Draft {
  id?: number; name: string; description: string; preparation: string; sampleType: string; turnaroundHours: string
  price: string; originalPrice: string; homeCollection: boolean; isPopular: boolean; status: 'draft' | 'published' | 'archived'; testIds: number[]
}

const empty = (): Draft => ({ name: '', description: '', preparation: '', sampleType: '', turnaroundHours: '', price: '', originalPrice: '', homeCollection: true, isPopular: false, status: 'draft', testIds: [] })

/** Health packages: contents and pricing are validated again on the server. */
export function PackagesPanel({ onToast }: { onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const packages = useAdminResource<AdminPackage[]>('/api/admin/packages')
  const tests = useAdminResource<{ tests: TestOption[] }>('/api/admin/tests')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<AdminPackage | null>(null)

  const save = async (status?: 'draft' | 'published') => {
    if (!draft) return
    setBusy(true)
    setError(null)
    const body = {
      name: draft.name,
      description: draft.description,
      preparation: draft.preparation,
      sampleType: draft.sampleType,
      turnaroundHours: draft.turnaroundHours ? Number(draft.turnaroundHours) : null,
      pricePaise: Math.round(Number(draft.price) * 100),
      originalPricePaise: draft.originalPrice ? Math.round(Number(draft.originalPrice) * 100) : null,
      homeCollection: draft.homeCollection,
      isPopular: draft.isPopular,
      status: status ?? draft.status,
      testIds: draft.testIds,
    }
    const result = await adminFetch(draft.id ? `/api/admin/packages/${draft.id}` : '/api/admin/packages', { method: draft.id ? 'PATCH' : 'POST', body })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setDraft(null)
    onToast(draft.id ? 'Package updated.' : 'Package created.')
    packages.reload()
  }

  const remove = async () => {
    if (!confirming) return
    const result = await adminFetch<{ archived?: boolean; message?: string }>(`/api/admin/packages/${confirming.id}`, { method: 'DELETE' })
    setConfirming(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(result.data.archived ? (result.data.message ?? 'Package archived.') : 'Package deleted.')
    packages.reload()
  }

  const testOptions = (tests.data?.tests ?? []).filter((test) => test.status !== 'archived')
  const selectedSum = draft ? draft.testIds.reduce((sum, id) => sum + (testOptions.find((test) => test.id === id)?.listPricePaise ?? 0), 0) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{packages.data ? `${packages.data.length} packages` : 'Loading…'}</p>
        <button type="button" onClick={() => { setError(null); setDraft(empty()) }} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> Add package</button>
      </div>

      {packages.error && <div className="card p-4 text-[12.5px] text-danger">{packages.error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {packages.loading && Array.from({ length: 3 }, (_, index) => <div key={index} className="card h-44 p-4"><div className="skeleton h-4 w-2/3" /><div className="skeleton mt-3 h-3 w-full" /><div className="skeleton mt-6 h-8 w-24" /></div>)}
        {packages.data?.length === 0 && (
          <div className="card md:col-span-2 xl:col-span-3"><EmptyState icon={Package} title="No health packages yet" description="Create a package by selecting published tests and setting a package price." action={<button type="button" onClick={() => setDraft(empty())} className="btn btn-primary btn-sm">Create package</button>} /></div>
        )}
        {packages.data?.map((pack) => (
          <article key={pack.id} className="card flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-[14px] font-bold text-navy">{pack.name}</h2>
                <p className="text-[11.5px] text-muted">{pack.testCount} tests · tests worth {formatINR(pack.testsSumPaise)}</p>
              </div>
              <span className={`badge ${pack.status === 'published' ? 'badge-green' : pack.status === 'draft' ? 'badge-amber' : 'badge-gray'}`}>{pack.status}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-[12.5px] leading-5 text-muted">{pack.description || 'No description.'}</p>
            <div className="mt-auto flex items-end justify-between gap-2 pt-3">
              <div>
                <b className="text-[17px] tabular-nums">{formatINR(pack.pricePaise)}</b>
                {pack.originalPricePaise && <del className="ml-1.5 text-[11px] text-muted">{formatINR(pack.originalPricePaise)}</del>}
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setDraft({ id: pack.id, name: pack.name, description: pack.description, preparation: pack.preparation, sampleType: pack.sampleType, turnaroundHours: pack.turnaroundHours ? String(pack.turnaroundHours) : '', price: String(pack.pricePaise / 100), originalPrice: pack.originalPricePaise ? String(pack.originalPricePaise / 100) : '', homeCollection: pack.homeCollection, isPopular: pack.isPopular, status: pack.status as Draft['status'], testIds: [] })} className="grid size-7 place-items-center rounded-md text-muted hover:bg-page" aria-label={`Edit ${pack.name}`}><Pencil size={14} aria-hidden /></button>
                <button type="button" onClick={() => setConfirming(pack)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label={`Archive ${pack.name}`}><Trash2 size={14} aria-hidden /></button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="package-form-title">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="package-form-title" className="text-[15px] font-bold">{draft.id ? 'Edit package' : 'New health package'}</h2>
              <button type="button" onClick={() => setDraft(null)} className="text-muted hover:text-ink" aria-label="Close"><X size={16} aria-hidden /></button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label htmlFor="pkg-name" className="label">Package name</label>
                <input id="pkg-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="input" />
              </div>
              <div>
                <label htmlFor="pkg-desc" className="label">Description</label>
                <textarea id="pkg-desc" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="input" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="pkg-price" className="label">Package price (₹)</label>
                  <input id="pkg-price" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" className="input" />
                </div>
                <div>
                  <label htmlFor="pkg-original" className="label">Original price (₹)</label>
                  <input id="pkg-original" value={draft.originalPrice} onChange={(event) => setDraft({ ...draft, originalPrice: event.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" className="input" placeholder="Optional" />
                </div>
                <div>
                  <label htmlFor="pkg-turnaround" className="label">Report hours</label>
                  <input id="pkg-turnaround" value={draft.turnaroundHours} onChange={(event) => setDraft({ ...draft, turnaroundHours: event.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" className="input" placeholder="24" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="pkg-sample" className="label">Sample type</label>
                  <input id="pkg-sample" value={draft.sampleType} onChange={(event) => setDraft({ ...draft, sampleType: event.target.value })} className="input" placeholder="Blood" />
                </div>
                <div>
                  <label htmlFor="pkg-status" className="label">Status</label>
                  <select id="pkg-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft['status'] })} className="input">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="pkg-prep" className="label">Preparation instructions</label>
                <textarea id="pkg-prep" rows={2} value={draft.preparation} onChange={(event) => setDraft({ ...draft, preparation: event.target.value })} className="input" />
              </div>
              <div className="flex flex-wrap gap-4 text-[12.5px]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.homeCollection} onChange={(event) => setDraft({ ...draft, homeCollection: event.target.checked })} className="size-4 accent-[#20A99C]" /> Home collection</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isPopular} onChange={(event) => setDraft({ ...draft, isPopular: event.target.checked })} className="size-4 accent-[#20A99C]" /> Popular</label>
              </div>
              <fieldset className="rounded-lg border border-line p-3">
                <legend className="px-1 text-[12px] font-semibold">Included tests ({draft.testIds.length}) · select at least one to publish</legend>
                <div className="max-h-48 overflow-y-auto">
                  {testOptions.map((test) => (
                    <label key={test.id} className="flex items-center justify-between gap-2 py-1 text-[12px]">
                      <span className="flex items-center gap-2"><input type="checkbox" checked={draft.testIds.includes(test.id)} onChange={(event) => setDraft({ ...draft, testIds: event.target.checked ? [...draft.testIds, test.id] : draft.testIds.filter((id) => id !== test.id) })} className="size-3.5 accent-[#20A99C]" /> {test.name}</span>
                      <span className="tabular-nums text-muted">{formatINR(test.listPricePaise)}{test.status !== 'published' ? ' · unpublished' : ''}</span>
                    </label>
                  ))}
                  {testOptions.length === 0 && <p className="py-2 text-[12px] text-muted">No tests available — create tests first.</p>}
                </div>
                <p className="mt-2 border-t border-line pt-2 text-[11.5px] text-muted">Individual total: <b className="text-ink">{formatINR(selectedSum)}</b>{draft.price && Number(draft.price) * 100 > selectedSum ? ' · package price exceeds the individual total' : ''}</p>
              </fieldset>
              {error && <p role="alert" className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[12.5px] text-danger">{error}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
              <button type="button" onClick={() => setDraft(null)} className="btn btn-outline">Cancel</button>
              <button type="button" onClick={() => save('draft')} disabled={busy} className="btn btn-outline">Save draft</button>
              <button type="button" onClick={() => save('published')} disabled={busy} className="btn btn-primary">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Save &amp; publish</button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#991b1b]"><Archive size={16} aria-hidden /> Remove “{confirming.name}”?</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">Packages used in existing bookings are archived rather than deleted.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(null)} className="btn btn-outline btn-sm">Cancel</button>
              <button type="button" onClick={remove} className="btn btn-danger btn-sm">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
