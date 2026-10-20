'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronLeft, ChevronRight, Search, SlidersHorizontal, TestTube2, X } from 'lucide-react'
import type { Category, TestView } from '@/lib/catalogue'
import { TestCard } from '@/components/site/test-card'
import { EmptyState, ErrorState, Skeletons } from '@/components/ui'

interface Result { tests: TestView[]; total: number; page: number; pages: number }

const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
] as const

/**
 * Catalogue browser: debounced search, category + sort filters and server-side
 * pagination. The count shown is the number of rows the query actually matched.
 */
export function TestsBrowser({ categories, initial }: { categories: Category[]; initial: Result }) {
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState(params.get('category') ?? 'all')
  const [sort, setSort] = useState<string>(params.get('sort') ?? 'name')
  const [page, setPage] = useState(Number(params.get('page') ?? '1') || 1)
  const [result, setResult] = useState<Result>(initial)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showFilters, setShowFilters] = useState(false)
  const first = useRef(true)

  const load = useCallback(async (next: { q: string; category: string; sort: string; page: number }) => {
    setState('loading')
    const search = new URLSearchParams()
    if (next.q) search.set('q', next.q)
    if (next.category !== 'all') search.set('category', next.category)
    if (next.sort !== 'name') search.set('sort', next.sort)
    if (next.page > 1) search.set('page', String(next.page))
    // Keep the URL shareable without triggering a server round-trip.
    window.history.replaceState(null, '', `/tests${search.size ? `?${search}` : ''}`)
    const response = await fetch(`/api/catalogue?${new URLSearchParams({ ...Object.fromEntries(search), page: String(next.page), pageSize: '12' })}`, { cache: 'no-store' })
    if (!response.ok) { setState('error'); return }
    setResult(await response.json() as Result)
    setState('idle')
  }, [])

  // Debounce typing; filters apply immediately.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const timer = setTimeout(() => { void load({ q: query, category, sort, page }) }, 300)
    return () => clearTimeout(timer)
  }, [query, category, sort, page, load])

  const activeFilters = (query ? 1 : 0) + (category !== 'all' ? 1 : 0) + (sort !== 'name' ? 1 : 0)

  const reset = () => { setQuery(''); setCategory('all'); setSort('name'); setPage(1) }

  return (
    <div className="container-x py-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="test-search" className="sr-only">Search diagnostic tests</label>
          <input
            id="test-search"
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1) }}
            placeholder="Search by test name, for example TSH, HbA1c, CBC"
            className="input h-11 pl-10 pr-10"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setPage(1) }} className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-page" aria-label="Clear search">
              <X size={15} aria-hidden />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowFilters((value) => !value)} className="btn btn-outline lg:hidden" aria-expanded={showFilters}>
            <SlidersHorizontal size={15} aria-hidden /> Filters {activeFilters > 0 && <span className="badge badge-teal">{activeFilters}</span>}
          </button>
          <div className={`${showFilters ? 'flex' : 'hidden'} flex-1 flex-wrap items-center gap-2 lg:flex`}>
            <label htmlFor="category-filter" className="sr-only">Category</label>
            <select id="category-filter" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }} className="input w-auto min-w-40">
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name} ({item.testCount})</option>)}
            </select>
            <label htmlFor="sort-filter" className="sr-only">Sort by</label>
            <select id="sort-filter" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }} className="input w-auto min-w-44">
              {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted" aria-live="polite">
          {state === 'loading' ? 'Searching…' : <><b className="text-ink">{result.total}</b> {result.total === 1 ? 'test' : 'tests'} found{query ? <> for “{query}”</> : null}</>}
        </p>
        {activeFilters > 0 && <button type="button" onClick={reset} className="text-[12.5px] font-semibold text-teal-700 hover:underline">Clear filters</button>}
      </div>

      <div className="mt-4">
        {state === 'loading' && <Skeletons count={6} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />}
        {state === 'error' && <div className="card"><ErrorState title="The catalogue could not be loaded" description="Please check your connection and try again." onRetry={() => load({ q: query, category, sort, page })} /></div>}
        {state === 'idle' && result.tests.length === 0 && (
          <div className="card">
            <EmptyState
              icon={TestTube2}
              title={query || category !== 'all' ? 'No tests match your filters' : 'No tests published yet'}
              description={query || category !== 'all' ? 'Try a different spelling, a shorter search term, or clear the filters.' : 'The laboratory has not published any tests yet. Please check back later or contact us.'}
              action={activeFilters > 0 ? <button type="button" onClick={reset} className="btn btn-outline btn-sm">Clear filters</button> : <a href="/contact" className="btn btn-primary btn-sm">Contact the lab</a>}
            />
          </div>
        )}
        {state === 'idle' && result.tests.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.tests.map((test) => <TestCard key={test.id} test={test} />)}
          </div>
        )}
      </div>

      {result.pages > 1 && state === 'idle' && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn btn-outline btn-sm"><ChevronLeft size={14} aria-hidden /> Previous</button>
          <span className="px-2 text-[12.5px] text-muted">Page {result.page} of {result.pages}</span>
          <button type="button" disabled={page >= result.pages} onClick={() => setPage((value) => Math.min(result.pages, value + 1))} className="btn btn-outline btn-sm">Next <ChevronRight size={14} aria-hidden /></button>
        </nav>
      )}

      <div className="mt-10 card flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <b className="text-[14px] font-semibold text-navy">Looking for a full price list?</b>
          <p className="text-[12.5px] text-muted">Browse every published investigation with prices in one searchable table.</p>
        </div>
        <a href="/price-list" className="btn btn-outline btn-sm">Open price list <ArrowRight size={14} aria-hidden /></a>
      </div>
    </div>
  )
}
