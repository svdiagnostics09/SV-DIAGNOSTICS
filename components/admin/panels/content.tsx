'use client'

import { useState } from 'react'
import { ExternalLink, HelpCircle, ImageIcon, Loader2, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import { Modal } from '@/components/admin/panels/catalogue-support'
import { EmptyState } from '@/components/ui'
import { useEffect, useRef } from 'react'

type Kind = 'banners' | 'faqs' | 'blog'

interface BannerRow { id: number; title: string; subtitle: string; ctaLabel: string; ctaHref: string; imageUrl: string; placement: string; sortOrder: number; isPublished: boolean }
interface FaqRow { id: number; question: string; answer: string; category: string; sortOrder: number; isPublished: boolean }
interface PostRow { id: number; title: string; slug: string; excerpt: string; coverImageUrl: string; author: string; status: string; publishedAt: string | null; updatedAt: string }

/** Banners, FAQs and blog posts share one CRUD surface. */
export function ContentPanel({ kind, onToast }: { kind: Kind; onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const resource = useAdminResource<Array<BannerRow | FaqRow | PostRow>>(`/api/admin/${kind}?all=1`)
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blank = (): Record<string, unknown> => kind === 'banners'
    ? { title: '', subtitle: '', ctaLabel: '', ctaHref: '/tests', imageUrl: '', placement: 'home', sortOrder: 0, isPublished: false }
    : kind === 'faqs'
      ? { question: '', answer: '', category: 'General', sortOrder: 0, isPublished: true }
      : { title: '', excerpt: '', body: '', coverImageUrl: '', author: 'SV Diagnostics', status: 'draft' }

  const save = async (status?: string) => {
    if (!draft) return
    setBusy(true); setError(null)
    const body = kind === 'blog' && status ? { ...draft, status } : draft
    const id = draft.id as number | undefined
    const result = await adminFetch(id ? `/api/admin/${kind}/${id}` : `/api/admin/${kind}`, { method: id ? 'PATCH' : 'POST', body })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setDraft(null); onToast(id ? 'Saved.' : 'Created.'); resource.reload()
  }

  const togglePublish = async (row: BannerRow | FaqRow | PostRow) => {
    const published = kind === 'blog' ? (row as PostRow).status === 'published' : (row as BannerRow | FaqRow).isPublished
    const body = kind === 'blog' ? { status: published ? 'draft' : 'published' } : { isPublished: !published }
    const result = await adminFetch(`/api/admin/${kind}/${row.id}`, { method: 'PATCH', body })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(published ? 'Unpublished.' : 'Published.'); resource.reload()
  }

  const remove = async (row: BannerRow | FaqRow | PostRow) => {
    if (!window.confirm('Delete this item permanently?')) return
    const result = await adminFetch(`/api/admin/${kind}/${row.id}`, { method: 'DELETE' })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast('Deleted.'); resource.reload()
  }

  const title = kind === 'banners' ? 'Banners' : kind === 'faqs' ? 'FAQs' : 'Blog posts'
  const Icon = kind === 'banners' ? ImageIcon : kind === 'faqs' ? HelpCircle : Newspaper
  const rows = (resource.data ?? []) as Array<BannerRow & FaqRow & PostRow>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{rows.length} {title.toLowerCase()}</p>
        <button type="button" onClick={() => { setError(null); setDraft(blank()) }} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> New</button>
      </div>
      {resource.error && <div className="card p-4 text-[12.5px] text-danger">{resource.error}</div>}
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[680px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">{kind === 'faqs' ? 'Question' : 'Title'}</th>
                {kind === 'banners' && <th scope="col" className="px-3 py-2 font-semibold">Placement</th>}
                {kind === 'blog' && <th scope="col" className="px-3 py-2 font-semibold">Slug</th>}
                {kind === 'faqs' && <th scope="col" className="px-3 py-2 font-semibold">Category</th>}
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {resource.loading && <tr><td colSpan={5} className="p-4"><div className="skeleton h-4 w-full" /></td></tr>}
              {!resource.loading && rows.length === 0 && <tr><td colSpan={5}><EmptyState icon={Icon} title={`No ${title.toLowerCase()} yet`} description="Published items appear on the public website." /></td></tr>}
              {rows.map((row) => {
                const published = kind === 'blog' ? row.status === 'published' : row.isPublished
                return (
                  <tr key={row.id}>
                    <td className="max-w-[340px] px-3 py-2.5">
                      <b className="block truncate font-semibold">{kind === 'faqs' ? row.question : row.title}</b>
                      <span className="line-clamp-1 text-[11px] text-muted">{kind === 'blog' ? row.excerpt : kind === 'banners' ? row.subtitle : row.answer}</span>
                    </td>
                    {kind === 'banners' && <td className="px-3 py-2.5 capitalize text-muted">{row.placement}</td>}
                    {kind === 'blog' && <td className="px-3 py-2.5 font-mono text-[11px] text-muted">{row.slug}</td>}
                    {kind === 'faqs' && <td className="px-3 py-2.5 text-muted">{row.category}</td>}
                    <td className="px-3 py-2.5"><span className={`badge ${published ? 'badge-green' : kind === 'blog' ? 'badge-amber' : 'badge-gray'}`}>{kind === 'blog' && !published ? row.status : published ? 'published' : 'hidden'}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {kind === 'blog' && published && <Link href={`/blog/${row.slug}`} target="_blank" rel="noopener" className="grid size-7 place-items-center rounded-md text-muted hover:bg-page" aria-label="Open post"><ExternalLink size={14} aria-hidden /></Link>}
                        <button type="button" onClick={() => togglePublish(row)} className="btn btn-ghost btn-sm">{published ? 'Unpublish' : 'Publish'}</button>
                        <button
                          type="button"
                          onClick={() => setDraft(kind === 'blog' ? { ...row, /* body fetched lazily below */ body: (row as unknown as { body?: string }).body ?? '' } : { ...row })}
                          className="grid size-7 place-items-center rounded-md text-muted hover:bg-page"
                          aria-label="Edit"
                        ><Pencil size={14} aria-hidden /></button>
                        <button type="button" onClick={() => remove(row)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label="Delete"><Trash2 size={14} aria-hidden /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {draft && kind === 'banners' && (
        <Modal title={draft.id ? 'Edit banner' : 'New banner'} onClose={() => setDraft(null)}>
          <div className="space-y-3">
            <Field label="Title" id="b-title"><input id="b-title" className="input" value={String(draft.title ?? '')} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
            <Field label="Subtitle" id="b-sub"><input id="b-sub" className="input" value={String(draft.subtitle ?? '')} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA label" id="b-cta"><input id="b-cta" className="input" value={String(draft.ctaLabel ?? '')} onChange={(event) => setDraft({ ...draft, ctaLabel: event.target.value })} /></Field>
              <Field label="CTA link" id="b-href"><input id="b-href" className="input" value={String(draft.ctaHref ?? '')} onChange={(event) => setDraft({ ...draft, ctaHref: event.target.value })} /></Field>
            </div>
            <Field label="Image URL (optional)" id="b-img"><input id="b-img" className="input" value={String(draft.imageUrl ?? '')} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="https://…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Placement" id="b-place">
                <select id="b-place" className="input" value={String(draft.placement ?? 'home')} onChange={(event) => setDraft({ ...draft, placement: event.target.value })}>
                  <option value="home">Home</option><option value="catalogue">Catalogue</option><option value="packages">Packages</option>
                </select>
              </Field>
              <Field label="Sort order" id="b-order"><input id="b-order" className="input" value={String(draft.sortOrder ?? 0)} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value.replace(/\D/g, '')) })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={Boolean(draft.isPublished)} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} className="size-4 accent-[#20A99C]" /> Published</label>
            {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
            <Footer busy={busy} onCancel={() => setDraft(null)} onSave={() => save()} />
          </div>
        </Modal>
      )}

      {draft && kind === 'faqs' && (
        <Modal title={draft.id ? 'Edit FAQ' : 'New FAQ'} onClose={() => setDraft(null)}>
          <div className="space-y-3">
            <Field label="Question" id="f-q"><input id="f-q" className="input" value={String(draft.question ?? '')} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></Field>
            <Field label="Answer" id="f-a"><textarea id="f-a" rows={4} className="input" value={String(draft.answer ?? '')} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" id="f-cat"><input id="f-cat" className="input" value={String(draft.category ?? 'General')} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></Field>
              <Field label="Sort order" id="f-order"><input id="f-order" className="input" value={String(draft.sortOrder ?? 0)} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value.replace(/\D/g, '')) })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={Boolean(draft.isPublished)} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} className="size-4 accent-[#20A99C]" /> Published</label>
            {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
            <Footer busy={busy} onCancel={() => setDraft(null)} onSave={() => save()} />
          </div>
        </Modal>
      )}

      {draft && kind === 'blog' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="blog-modal-title">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-line px-5 py-4"><h2 id="blog-modal-title" className="text-[15px] font-bold">{draft.id ? 'Edit post' : 'New post'}</h2></div>
            <div className="space-y-3 px-5 py-4">
              <Field label="Title" id="p-title"><input id="p-title" className="input" value={String(draft.title ?? '')} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
              <Field label="Excerpt" id="p-excerpt"><textarea id="p-excerpt" rows={2} className="input" value={String(draft.excerpt ?? '')} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} /></Field>
              <BlogBodyLoader id={draft.id as number | undefined} body={String(draft.body ?? '')} onChange={(body) => setDraft((current) => current ? { ...current, body } : current)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Author" id="p-author"><input id="p-author" className="input" value={String(draft.author ?? 'SV Diagnostics')} onChange={(event) => setDraft({ ...draft, author: event.target.value })} /></Field>
                <Field label="Cover image URL" id="p-cover"><input id="p-cover" className="input" value={String(draft.coverImageUrl ?? '')} onChange={(event) => setDraft({ ...draft, coverImageUrl: event.target.value })} /></Field>
              </div>
              {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDraft(null)} className="btn btn-outline btn-sm">Cancel</button>
                <button type="button" onClick={() => save('draft')} disabled={busy} className="btn btn-outline btn-sm">Save draft</button>
                <button type="button" onClick={() => save('published')} disabled={busy} className="btn btn-primary btn-sm">{busy && <Loader2 size={13} className="animate-spin" aria-hidden />} Publish</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Blog list responses omit the body; fetch it once when the editor opens. */
function BlogBodyLoader({ id, body, onChange }: { id?: number; body: string; onChange: (body: string) => void }) {
  const loaded = useRef(false)
  useEffect(() => {
    if (!id || loaded.current || body) return
    loaded.current = true
    adminFetch<{ body: string }>(`/api/admin/blog/${id}/preview`).then((result) => { if (result.ok) onChange(result.data.body ?? '') }).catch(() => undefined)
  }, [id, body, onChange])
  return <Field label="Body" id="p-body"><textarea id="p-body" rows={12} className="input font-mono text-[12.5px]" value={body} onChange={(event) => onChange(event.target.value)} placeholder="Write the article. Paragraphs are preserved." /></Field>
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="label">{label}</label>{children}</div>
}

function Footer({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="btn btn-outline btn-sm">Cancel</button>
      <button type="button" onClick={onSave} disabled={busy} className="btn btn-primary btn-sm">{busy && <Loader2 size={13} className="animate-spin" aria-hidden />} Save</button>
    </div>
  )
}
