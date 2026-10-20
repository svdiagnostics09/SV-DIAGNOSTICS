'use client'

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

interface Draft {
  name: string
  slug: string
  description: string
  price: string
  discountType: 'none' | 'percent' | 'amount'
  discountValue: string
  sampleType: string
  sampleTypes: string
  reportType: string
  turnaroundHours: string
  preparation: string
  fastingRequired: boolean
  fastingHours: string
  categoryId: string
  homeCollection: boolean
  isPopular: boolean
  status: 'draft' | 'published' | 'archived'
  investigationIds: number[]
}

export const emptyTest = (categoryId?: number): Draft => ({
  name: '', slug: '', description: '', price: '', discountType: 'none', discountValue: '', sampleType: '', sampleTypes: '',
  reportType: '', turnaroundHours: '', preparation: '', fastingRequired: false, fastingHours: '', categoryId: categoryId ? String(categoryId) : '',
  homeCollection: true, isPopular: false, status: 'draft', investigationIds: [],
})

export function TestForm({ categories, investigations, initial, onCancel, onSaved }: {
  categories: Array<{ id: number; name: string }>
  investigations: Array<{ id: number; name: string }>
  initial?: Partial<Draft> & { id?: number }
  onCancel: () => void
  onSaved: (message: string) => void
}) {
  const [draft, setDraft] = useState<Draft>({ ...emptyTest(categories[0]?.id), ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  const save = async (status?: 'draft' | 'published') => {
    setError(null)
    const next: Record<string, string> = {}
    if (draft.name.trim().length < 2) next.name = 'Enter the test name.'
    if (!draft.price || Number(draft.price) <= 0) next.price = 'Enter a price greater than zero.'
    if (draft.discountType === 'percent' && (Number(draft.discountValue) < 1 || Number(draft.discountValue) > 100)) next.discountValue = 'Percentage must be between 1 and 100.'
    if (draft.discountType === 'amount' && Number(draft.discountValue) * 100 >= Number(draft.price) * 100) next.discountValue = 'Flat discount must be less than the price.'
    if (draft.fastingRequired && draft.fastingHours && Number(draft.fastingHours) > 48) next.fastingHours = 'Fasting hours must be 48 or less.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    const payload = {
      name: draft.name.trim(),
      categoryId: draft.categoryId ? Number(draft.categoryId) : null,
      description: draft.description,
      pricePaise: Math.round(Number(draft.price) * 100),
      discountType: draft.discountType,
      discountValue: draft.discountType === 'none' ? 0 : draft.discountType === 'percent' ? Number(draft.discountValue) : Math.round(Number(draft.discountValue) * 100),
      sampleType: draft.sampleType,
      sampleTypes: draft.sampleTypes.split(',').map((item) => item.trim()).filter(Boolean),
      reportType: draft.reportType,
      turnaroundHours: draft.turnaroundHours ? Number(draft.turnaroundHours) : null,
      preparation: draft.preparation,
      fastingRequired: draft.fastingRequired,
      fastingHours: draft.fastingRequired && draft.fastingHours ? Number(draft.fastingHours) : null,
      homeCollection: draft.homeCollection,
      isPopular: draft.isPopular,
      status: status ?? draft.status,
      investigationIds: draft.investigationIds,
    }
    const response = await fetch(initial?.id ? `/api/admin/tests/${initial.id}` : '/api/admin/tests', {
      method: initial?.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setError(body.error ?? 'The test could not be saved.'); return }
    onSaved(initial?.id ? 'Test updated.' : (payload.status === 'published' ? 'Test created and published.' : 'Test saved as draft.'))
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="test-form-title">
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="test-form-title" className="text-[15px] font-bold">{initial?.id ? 'Edit test' : 'Add a new test'}</h2>
          <button type="button" onClick={onCancel} className="text-[12.5px] font-medium text-muted hover:text-ink">Close</button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div>
              <label htmlFor="t-name" className="label">Test name *</label>
              <input id="t-name" value={draft.name} onChange={(event) => set('name', event.target.value)} className="input" aria-invalid={Boolean(errors.name)} />
              {errors.name && <p className="mt-1 text-[11.5px] text-danger">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="t-category" className="label">Category</label>
              <select id="t-category" value={draft.categoryId} onChange={(event) => set('categoryId', event.target.value)} className="input">
                <option value="">Uncategorised</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-price" className="label">List price (₹) *</label>
              <input id="t-price" value={draft.price} onChange={(event) => set('price', event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="input" aria-invalid={Boolean(errors.price)} />
              {errors.price && <p className="mt-1 text-[11.5px] text-danger">{errors.price}</p>}
            </div>
            <div>
              <label htmlFor="t-sample" className="label">Sample type</label>
              <input id="t-sample" value={draft.sampleType} onChange={(event) => set('sampleType', event.target.value)} className="input" placeholder="Blood, serum, urine…" />
            </div>
            <div>
              <label htmlFor="t-turnaround" className="label">Report turnaround (hours)</label>
              <input id="t-turnaround" value={draft.turnaroundHours} onChange={(event) => set('turnaroundHours', event.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input" placeholder="24" />
            </div>
            <div>
              <label htmlFor="t-report" className="label">Report type</label>
              <input id="t-report" value={draft.reportType} onChange={(event) => set('reportType', event.target.value)} className="input" placeholder="Digital report" />
            </div>
          </div>

          <fieldset className="rounded-lg border border-line p-3">
            <legend className="px-1 text-[12px] font-semibold">Discount</legend>
            <div className="flex flex-wrap items-center gap-2">
              <select value={draft.discountType} onChange={(event) => set('discountType', event.target.value as Draft['discountType'])} className="input w-auto">
                <option value="none">No discount</option>
                <option value="percent">Percent off</option>
                <option value="amount">Flat ₹ off</option>
              </select>
              {draft.discountType !== 'none' && (
                <input value={draft.discountValue} onChange={(event) => set('discountValue', event.target.value.replace(/[^\d.]/g, ''))} className="input w-28" inputMode="decimal" placeholder={draft.discountType === 'percent' ? '10' : '100'} aria-label={draft.discountType === 'percent' ? 'Discount percent' : 'Discount amount'} />
              )}
              {draft.price && draft.discountType !== 'none' && (
                <span className="text-[12px] text-muted">Patients pay ₹{(() => { const p = Number(draft.price); const v = Number(draft.discountValue) || 0; return (draft.discountType === 'percent' ? p * (100 - Math.min(100, v)) / 100 : Math.max(0, p - v)).toLocaleString('en-IN', { maximumFractionDigits: 2 }) })()}</span>
              )}
            </div>
            {errors.discountValue && <p className="mt-1 text-[11.5px] text-danger">{errors.discountValue}</p>}
          </fieldset>

          <div>
            <label htmlFor="t-desc" className="label">Description</label>
            <textarea id="t-desc" value={draft.description} onChange={(event) => set('description', event.target.value)} rows={3} className="input" placeholder="What the test measures and why it is ordered. Shown on the test page." />
          </div>
          <div>
            <label htmlFor="t-available" className="label">Available sample types <span className="font-normal text-muted">(comma separated)</span></label>
            <input id="t-available" value={draft.sampleTypes} onChange={(event) => set('sampleTypes', event.target.value)} className="input" placeholder="Serum, Plasma" />
          </div>
          <div>
            <label htmlFor="t-prep" className="label">Preparation instructions</label>
            <textarea id="t-prep" value={draft.preparation} onChange={(event) => set('preparation', event.target.value)} rows={2} className="input" placeholder="e.g. 8–10 hours fasting, water allowed" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.fastingRequired} onChange={(event) => set('fastingRequired', event.target.checked)} className="size-4 accent-[#20A99C]" /> Fasting required</label>
            {draft.fastingRequired && (
              <label className="flex items-center gap-2 text-[12.5px]">for <input value={draft.fastingHours} onChange={(event) => set('fastingHours', event.target.value.replace(/\D/g, '').slice(0, 2))} className="input h-8 w-16" inputMode="numeric" aria-label="Fasting hours" /> hours</label>
            )}
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.homeCollection} onChange={(event) => set('homeCollection', event.target.checked)} className="size-4 accent-[#20A99C]" /> Home collection eligible</label>
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.isPopular} onChange={(event) => set('isPopular', event.target.checked)} className="size-4 accent-[#20A99C]" /> Popular</label>
          </div>
          {errors.fastingHours && <p className="text-[11.5px] text-danger">{errors.fastingHours}</p>}

          {investigations.length > 0 && (
            <fieldset className="rounded-lg border border-line p-3">
              <legend className="px-1 text-[12px] font-semibold">Investigations included</legend>
              <div className="grid max-h-32 gap-1 overflow-y-auto sm:grid-cols-2">
                {investigations.map((investigation) => (
                  <label key={investigation.id} className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" checked={draft.investigationIds.includes(investigation.id)} onChange={(event) => set('investigationIds', event.target.checked ? [...draft.investigationIds, investigation.id] : draft.investigationIds.filter((id) => id !== investigation.id))} className="size-3.5 accent-[#20A99C]" />
                    {investigation.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {error && <p role="alert" className="flex items-center gap-1.5 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12.5px] text-danger"><AlertCircle size={14} aria-hidden /> {error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={onCancel} className="btn btn-outline">Cancel</button>
          <button type="button" onClick={() => save('draft')} disabled={busy} className="btn btn-outline">Save draft</button>
          <button type="button" onClick={() => save('published')} disabled={busy} className="btn btn-primary">
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null} {initial?.id ? 'Save & publish' : 'Publish test'}
          </button>
        </div>
      </div>
    </div>
  )
}

export type { Draft as TestDraft }
