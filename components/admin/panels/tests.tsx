'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, Check, ExternalLink, Eye, EyeOff, Filter, Pencil, Plus, Search, TestTube2, Trash2 } from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import { TestForm, type TestDraft } from '@/components/admin/test-form'
import { formatINR } from '@/lib/format'
import { TestCard } from '@/components/site/test-card'
import { sampleLabel, turnaroundLabel } from '@/lib/labels'
import { EmptyState } from '@/components/ui'

interface AdminTest {
  id: number; name: string; slug: string; categoryId: number | null; categoryName: string; shortDescription: string; description: string
  sampleType: string; sampleTypes: string[]; reportType: string; turnaroundHours: number | null; preparation: string; fastingRequired: boolean
  fastingHours: number | null; pricePaise: number; listPricePaise: number; discountType: 'none' | 'percent' | 'amount'; discountValue: number
  homeCollection: boolean; isPopular: boolean; status: 'draft' | 'published' | 'archived'; investigationCount?: number
}

interface Category { id: number; name: string }
interface Investigation { id: number; name: string }

const statusBadge = (status: string) => status === 'published' ? 'badge-green' : status === 'draft' ? 'badge-amber' : 'badge-gray'

export function TestsPanel({ onToast }: { onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const tests = useAdminResource<{ tests: AdminTest[] }>('/api/admin/tests')
  const categories = useAdminResource<Category[]>('/api/admin/categories?all=1')
  const investigations = useAdminResource<Investigation[]>('/api/admin/investigations?all=1')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [editor, setEditor] = useState<(Partial<TestDraft> & { id?: number }) | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminTest | null>(null)
  const [viewing, setViewing] = useState<AdminTest | null>(null)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (tests.data?.tests ?? []).filter((test) =>
      (status === 'all' || test.status === status)
      && (category === 'all' || String(test.categoryId) === category)
      && (!needle || `${test.name} ${test.categoryName} ${test.sampleType}`.toLowerCase().includes(needle)),
    )
  }, [tests.data, query, status, category])

  const patch = async (test: AdminTest, body: Record<string, unknown>, message: string) => {
    setBusyId(test.id)
    const result = await adminFetch(`/api/admin/tests/${test.id}`, { method: 'PATCH', body })
    setBusyId(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(message)
    tests.reload()
  }

  const remove = async () => {
    if (!confirmDelete) return
    setBusyId(confirmDelete.id)
    const result = await adminFetch<{ archived?: boolean; message?: string }>(`/api/admin/tests/${confirmDelete.id}`, { method: 'DELETE' })
    setBusyId(null)
    setConfirmDelete(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(result.data.archived ? (result.data.message ?? 'Test archived.') : 'Test deleted.')
    tests.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted">{tests.data ? `${tests.data.tests.length} tests in the catalogue` : 'Loading…'} · changes publish to the website immediately</p>
        </div>
        <button type="button" onClick={() => setEditor({})} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> Add test</button>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="admin-test-search" className="sr-only">Search tests</label>
          <input id="admin-test-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, category or sample" className="input pl-9" />
        </div>
        <label htmlFor="admin-test-status" className="sr-only">Status</label>
        <select id="admin-test-status" value={status} onChange={(event) => setStatus(event.target.value)} className="input w-auto">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <label htmlFor="admin-test-category" className="sr-only">Category</label>
        <select id="admin-test-category" value={category} onChange={(event) => setCategory(event.target.value)} className="input w-auto">
          <option value="all">All categories</option>
          {(categories.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" onClick={() => { setQuery(''); setStatus('all'); setCategory('all') }} className="btn btn-ghost btn-sm"><Filter size={14} aria-hidden /> Clear</button>
      </div>

      {tests.error && <div className="card p-4 text-[12.5px] text-danger">{tests.error}</div>}

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[860px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Test</th>
                <th scope="col" className="px-3 py-2 font-semibold">Category</th>
                <th scope="col" className="px-3 py-2 font-semibold">Sample</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Price</th>
                <th scope="col" className="px-3 py-2 font-semibold">Report</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tests.loading && Array.from({ length: 5 }, (_, index) => (
                <tr key={index}><td colSpan={7} className="px-3 py-3"><div className="skeleton h-4 w-full" /></td></tr>
              ))}
              {!tests.loading && rows.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={TestTube2} title="No tests match this view" description="Adjust the filters, or add the first test to the catalogue." action={<button type="button" onClick={() => setEditor({})} className="btn btn-primary btn-sm"><Plus size={14} aria-hidden /> Add test</button>} /></td></tr>
              )}
              {rows.map((test) => (
                <tr key={test.id} className="hover:bg-page/60">
                  <td className="max-w-[240px] px-3 py-2.5">
                    <b className="block truncate text-[12.5px] font-semibold text-navy">{test.name}</b>
                    <span className="text-[10.5px] text-muted">{test.homeCollection ? 'Home eligible' : 'Lab only'}{test.isPopular ? ' · popular' : ''}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{test.categoryName || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{test.sampleType || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <b>{formatINR(test.listPricePaise)}</b>
                    {test.listPricePaise < test.pricePaise && <del className="ml-1 block text-[10.5px] text-muted">{formatINR(test.pricePaise)}</del>}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{turnaroundLabel(test.turnaroundHours)}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${statusBadge(test.status)}`}>{test.status}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" onClick={() => setViewing(test)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-page" aria-label={`View ${test.name}`}><Eye size={14} aria-hidden /></button>
                      <button type="button" onClick={() => setEditor({ id: test.id, ...toDraft(test) })} className="grid size-7 place-items-center rounded-md text-muted hover:bg-page" aria-label={`Edit ${test.name}`}><Pencil size={14} aria-hidden /></button>
                      <button
                        type="button"
                        disabled={busyId === test.id}
                        onClick={() => patch(test, { status: test.status === 'published' ? 'draft' : 'published' }, test.status === 'published' ? 'Test unpublished.' : 'Test published.')}
                        className="grid size-7 place-items-center rounded-md text-muted hover:bg-page disabled:opacity-40"
                        aria-label={test.status === 'published' ? `Unpublish ${test.name}` : `Publish ${test.name}`}
                      >
                        {test.status === 'published' ? <EyeOff size={14} aria-hidden /> : <Check size={14} aria-hidden />}
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(test)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label={`Archive or delete ${test.name}`}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editor && (
        <TestForm
          categories={categories.data ?? []}
          investigations={investigations.data ?? []}
          initial={editor}
          onCancel={() => setEditor(null)}
          onSaved={(message) => { setEditor(null); onToast(message); tests.reload() }}
        />
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4" role="dialog" aria-modal="true" aria-labelledby="view-test-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="view-test-title" className="text-[16px] font-bold">{viewing.name}</h2>
                <p className="text-[12px] text-muted">{viewing.categoryName} · <span className={`badge ${statusBadge(viewing.status)}`}>{viewing.status}</span></p>
              </div>
              <button type="button" onClick={() => setViewing(null)} className="text-[12px] font-medium text-muted hover:text-ink">Close</button>
            </div>
            <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-muted">{viewing.description || 'No description.'}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
              <div><dt className="text-muted">Price</dt><dd className="font-semibold">{formatINR(viewing.listPricePaise)}</dd></div>
              <div><dt className="text-muted">Sample</dt><dd>{viewing.sampleType || '—'}</dd></div>
              <div><dt className="text-muted">Report</dt><dd>{turnaroundLabel(viewing.turnaroundHours)}</dd></div>
              <div><dt className="text-muted">Preparation</dt><dd>{viewing.preparation || '—'}</dd></div>
              <div><dt className="text-muted">Fasting</dt><dd>{viewing.fastingRequired ? `Required${viewing.fastingHours ? ` (${viewing.fastingHours} h)` : ''}` : 'Not required'}</dd></div>
              <div><dt className="text-muted">Investigation links</dt><dd>{viewing.investigationCount ?? 0}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/tests/${viewing.slug}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Public page <ExternalLink size={12} aria-hidden /></Link>
              <button type="button" onClick={() => { setEditor({ id: viewing.id, ...toDraft(viewing) }); setViewing(null) }} className="btn btn-primary btn-sm">Edit</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-test-title">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-[#991b1b]"><Archive size={16} aria-hidden /><h2 id="delete-test-title" className="text-[15px] font-bold">Archive “{confirmDelete.name}”?</h2></div>
            <p className="mt-2 text-[13px] leading-6 text-muted">Tests referenced by bookings or packages are archived (hidden from the website) instead of deleted. Bookings keep their historical item names.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn btn-outline btn-sm">Cancel</button>
              <button type="button" onClick={remove} disabled={busyId === confirmDelete.id} className="btn btn-danger btn-sm">Archive or delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function toDraft(test: AdminTest): Partial<TestDraft> {
  return {
    name: test.name,
    categoryId: test.categoryId ? String(test.categoryId) : '',
    description: test.description,
    price: String(test.pricePaise / 100),
    discountType: test.discountType,
    discountValue: test.discountType === 'none' ? '' : test.discountType === 'percent' ? String(test.discountValue) : String(test.discountValue / 100),
    sampleType: test.sampleType,
    sampleTypes: test.sampleTypes.join(', '),
    reportType: test.reportType,
    turnaroundHours: test.turnaroundHours ? String(test.turnaroundHours) : '',
    preparation: test.preparation,
    fastingRequired: test.fastingRequired,
    fastingHours: test.fastingHours ? String(test.fastingHours) : '',
    homeCollection: test.homeCollection,
    isPopular: test.isPopular,
    status: test.status,
  }
}
