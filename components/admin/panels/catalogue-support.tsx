'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, Tags, Trash2, X, Stethoscope } from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import { EmptyState } from '@/components/ui'

interface CategoryRow { id: number; name: string; slug: string; description: string; sortOrder: number; isActive: boolean; testCount: number }
interface InvestigationRow { id: number; name: string; description: string; isActive: boolean; testCount: number }

export function CategoriesPanel({ onToast }: { onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const categories = useAdminResource<CategoryRow[]>('/api/admin/categories?all=1')
  const [draft, setDraft] = useState<Partial<CategoryRow> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    const body = { name: draft.name ?? '', description: draft.description ?? '', sortOrder: draft.sortOrder ?? 0, isActive: draft.isActive ?? true }
    const result = await adminFetch(draft.id ? `/api/admin/categories/${draft.id}` : '/api/admin/categories', { method: draft.id ? 'PATCH' : 'POST', body })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setDraft(null); onToast('Category saved.'); categories.reload()
  }

  const toggle = async (row: CategoryRow) => {
    const result = await adminFetch(`/api/admin/categories/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(row.isActive ? 'Category deactivated.' : 'Category activated.'); categories.reload()
  }

  const remove = async (row: CategoryRow) => {
    if (!window.confirm(`Delete “${row.name}”? Categories used by tests cannot be deleted.`)) return
    const result = await adminFetch(`/api/admin/categories/${row.id}`, { method: 'DELETE' })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast('Category deleted.'); categories.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{categories.data?.length ?? 0} categories</p>
        <button type="button" onClick={() => { setError(null); setDraft({ name: '', description: '', sortOrder: 0, isActive: true }) }} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> Add category</button>
      </div>
      {categories.error && <div className="card p-4 text-[12.5px] text-danger">{categories.error}</div>}
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Category</th><th scope="col" className="px-3 py-2 font-semibold">Slug</th><th scope="col" className="px-3 py-2 text-right font-semibold">Tests</th><th scope="col" className="px-3 py-2 font-semibold">Status</th><th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {categories.loading && <tr><td colSpan={5} className="p-4"><div className="skeleton h-4 w-full" /></td></tr>}
              {categories.data?.length === 0 && <tr><td colSpan={5}><EmptyState icon={Tags} title="No categories yet" description="Add a category to organise tests on the website." /></td></tr>}
              {categories.data?.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5"><b className="font-semibold">{row.name}</b>{row.description && <p className="text-[11px] text-muted">{row.description}</p>}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted">{row.slug}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.testCount}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${row.isActive ? 'badge-green' : 'badge-gray'}`}>{row.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => toggle(row)} className="btn btn-ghost btn-sm">{row.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button type="button" onClick={() => setDraft(row)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-page" aria-label={`Edit ${row.name}`}><Pencil size={14} aria-hidden /></button>
                      <button type="button" onClick={() => remove(row)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label={`Delete ${row.name}`}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {draft && (
        <Modal title={draft.id ? 'Edit category' : 'New category'} onClose={() => setDraft(null)}>
          <div className="space-y-3">
            <div><label htmlFor="cat-name" className="label">Name</label><input id="cat-name" value={draft.name ?? ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="input" /></div>
            <div><label htmlFor="cat-desc" className="label">Description</label><textarea id="cat-desc" rows={2} value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="cat-order" className="label">Sort order</label><input id="cat-order" value={draft.sortOrder ?? 0} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value.replace(/\D/g, '')) })} className="input" /></div>
              <label className="mt-6 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.isActive ?? true} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="size-4 accent-[#20A99C]" /> Active</label>
            </div>
            {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDraft(null)} className="btn btn-outline btn-sm">Cancel</button>
              <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy && <Loader2 size={13} className="animate-spin" aria-hidden />} Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function InvestigationsPanel({ onToast }: { onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const investigations = useAdminResource<InvestigationRow[]>('/api/admin/investigations?all=1')
  const [draft, setDraft] = useState<Partial<InvestigationRow> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    const body = { name: draft.name ?? '', description: draft.description ?? '', isActive: draft.isActive ?? true }
    const result = await adminFetch(draft.id ? `/api/admin/investigations/${draft.id}` : '/api/admin/investigations', { method: draft.id ? 'PATCH' : 'POST', body })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setDraft(null); onToast('Investigation saved.'); investigations.reload()
  }

  const remove = async (row: InvestigationRow) => {
    if (!window.confirm(`Delete “${row.name}”? Investigations linked to tests cannot be deleted.`)) return
    const result = await adminFetch(`/api/admin/investigations/${row.id}`, { method: 'DELETE' })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast('Investigation deleted.'); investigations.reload()
  }

  const toggle = async (row: InvestigationRow) => {
    const result = await adminFetch(`/api/admin/investigations/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!result.ok) { onToast(result.error, 'error'); return }
    investigations.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{investigations.data?.length ?? 0} investigations · link them to tests from the test editor</p>
        <button type="button" onClick={() => { setError(null); setDraft({ name: '', description: '', isActive: true }) }} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> Add investigation</button>
      </div>
      {investigations.error && <div className="card p-4 text-[12.5px] text-danger">{investigations.error}</div>}
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[600px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Investigation</th><th scope="col" className="px-3 py-2 text-right font-semibold">Linked tests</th><th scope="col" className="px-3 py-2 font-semibold">Status</th><th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {investigations.loading && <tr><td colSpan={4} className="p-4"><div className="skeleton h-4 w-full" /></td></tr>}
              {investigations.data?.length === 0 && <tr><td colSpan={4}><EmptyState icon={Stethoscope} title="No investigations yet" description={'Investigations describe what a test measures, for example “Total T3, T4, TSH”.'} /></td></tr>}
              {investigations.data?.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5"><b className="font-semibold">{row.name}</b>{row.description && <p className="text-[11px] text-muted">{row.description}</p>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.testCount}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${row.isActive ? 'badge-green' : 'badge-gray'}`}>{row.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => toggle(row)} className="btn btn-ghost btn-sm">{row.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button type="button" onClick={() => setDraft(row)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-page" aria-label={`Edit ${row.name}`}><Pencil size={14} aria-hidden /></button>
                      <button type="button" onClick={() => remove(row)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label={`Delete ${row.name}`}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {draft && (
        <Modal title={draft.id ? 'Edit investigation' : 'New investigation'} onClose={() => setDraft(null)}>
          <div className="space-y-3">
            <div><label htmlFor="inv-name" className="label">Name</label><input id="inv-name" value={draft.name ?? ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="input" /></div>
            <div><label htmlFor="inv-desc" className="label">Description</label><textarea id="inv-desc" rows={2} value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="input" /></div>
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.isActive ?? true} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="size-4 accent-[#20A99C]" /> Active</label>
            {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDraft(null)} className="btn btn-outline btn-sm">Cancel</button>
              <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy && <Loader2 size={13} className="animate-spin" aria-hidden />} Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/40 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="modal-title" className="text-[15px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Close"><X size={16} aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
