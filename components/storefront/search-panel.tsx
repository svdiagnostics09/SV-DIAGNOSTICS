'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Search, X } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { useCity } from '@/components/storefront/city-provider'
import { useStoreUI } from '@/components/storefront/ui-provider'
import type { StoreProduct } from '@/lib/storefront/product'

type Mode = 'tests' | 'checkups'

interface SearchPayload {
  tests: StoreProduct[]
  packages: StoreProduct[]
}

/**
 * Floating hero search. Filters the live catalogue by query and by mode
 * (Lab Tests / Checkups). Results link to detail pages; the row action adds
 * the item to the cart without leaving the panel.
 */
export function SearchPanel({ initial }: { initial: SearchPayload }) {
  const { city } = useCity()
  const { openProduct } = useStoreUI()
  const [mode, setMode] = useState<Mode>('tests')
  const [query, setQuery] = useState('')
  const [data, setData] = useState<SearchPayload>(initial)
  // Keep the seed in a ref: the page passes a fresh object each render, and an
  // object in the dep array would re-run (and abort) the request endlessly.
  const seedRef = useRef<SearchPayload>(initial)
  seedRef.current = initial
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    const term = query.trim()
    if (!term) { setData(seedRef.current); setFailed(false); setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('search failed')
        const body = await response.json() as SearchPayload
        setData({ tests: body.tests ?? [], packages: body.packages ?? [] })
        setFailed(false)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setFailed(true)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const results = mode === 'tests' ? data.tests : data.packages
  const visible = useMemo(() => results.slice(0, 6), [results])
  const browseHref = mode === 'tests'
    ? (query.trim() ? `/tests?q=${encodeURIComponent(query.trim())}` : '/tests')
    : '/packages'

  const switchMode = (next: Mode) => { setMode(next); setOpen(true); setFailed(false) }

  return (
    <section className="relative z-30 -mt-6 sm:-mt-8">
      <div className="container-x">
        <div ref={wrapRef} className="relative mx-auto max-w-3xl">
          <div className="rounded-2xl border border-line bg-white p-2 shadow-float sm:rounded-full sm:p-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <label htmlFor="hero-search" className="sr-only">Search for checkups and tests</label>
                <input
                  id="hero-search"
                  type="search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}
                  placeholder={mode === 'tests' ? 'Search for tests, e.g. thyroid, CBC, vitamin D' : 'Search for checkups, e.g. full body, women'}
                  className="h-11 w-full rounded-full bg-transparent pl-11 pr-10 text-[14px] text-ink outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="hero-search-results"
                  aria-autocomplete="list"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-section hover:text-ink" aria-label="Clear search">
                    <X size={14} aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('tests')}
                  aria-pressed={mode === 'tests'}
                  className={`btn h-11 flex-1 rounded-full px-5 sm:flex-none ${mode === 'tests' ? 'btn-primary' : 'btn-outline'}`}
                >
                  Lab Tests
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('checkups')}
                  aria-pressed={mode === 'checkups'}
                  className={`btn h-11 flex-1 rounded-full px-5 sm:flex-none ${mode === 'checkups' ? 'btn-mint' : 'btn-outline'}`}
                >
                  Checkups
                </button>
              </div>
            </div>
          </div>

          {open && (
            <div id="hero-search-results" role="listbox" aria-label="Search results" className="absolute inset-x-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
              <p className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted">
                <span>{query.trim() ? (loading ? 'Searching…' : `Matching ${mode === 'tests' ? 'lab tests' : 'checkups'} in ${city.name}`) : `Popular ${mode === 'tests' ? 'lab tests' : 'checkups'} in ${city.name}`}</span>
                {loading && <Loader2 size={13} className="animate-spin text-green" aria-hidden />}
              </p>

              {failed ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[13px] font-semibold text-ink">Search is unavailable right now</p>
                  <p className="mt-1 text-[12px] text-muted">You can still browse the full catalogue.</p>
                  <Link href={browseHref} className="btn btn-outline btn-sm mt-3">Browse all</Link>
                </div>
              ) : visible.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[13px] font-semibold text-ink">No {mode === 'tests' ? 'tests' : 'checkups'} match “{query.trim()}”</p>
                  <p className="mt-1 text-[12px] text-muted">Try a shorter term, or switch to {mode === 'tests' ? 'Checkups' : 'Lab Tests'}.</p>
                  <Link href="/contact" className="btn btn-outline btn-sm mt-3">Ask our team</Link>
                </div>
              ) : (
                <ul>
                  {visible.map((item) => (
                    <li key={`${item.kind}-${item.id}`} role="option" aria-selected="false">
                      <div className="flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-section">
                        <button type="button" onClick={() => openProduct(item)} className="min-w-0 flex-1 text-left">
                          <b className="block truncate text-[13px] font-semibold text-ink">{item.name}</b>
                          <span className="block truncate text-[11px] text-muted">{item.categoryName}</span>
                        </button>
                        <span className="shrink-0 text-right">
                          <b className="block text-[12.5px] tabular-nums text-ink">{formatINR(item.pricePaise)}</b>
                          {item.listPricePaise > item.pricePaise && <span className="price-was text-[10.5px]">{formatINR(item.listPricePaise)}</span>}
                        </span>
                        <Link
                          href={item.kind === 'package' ? `/packages/${item.slug}` : `/tests/${item.slug}`}
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-mint-50 text-mint-700 transition hover:bg-mint-700 hover:text-white"
                          aria-label={`Open ${item.name}`}
                        >
                          <ArrowRight size={13} aria-hidden />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Link href={browseHref} className="flex items-center justify-between gap-2 border-t border-line-soft px-4 py-2.5 text-[12.5px] font-semibold text-green hover:bg-mint-50/60">
                Browse all {mode === 'tests' ? 'lab tests' : 'checkups'}
                <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
