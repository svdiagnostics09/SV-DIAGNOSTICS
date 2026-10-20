'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MapPin, Search } from 'lucide-react'
import { formatINR } from '@/lib/format'

type Suggestion = { id: number; name: string; slug: string; category: string; pricePaise: number }

/**
 * Hero search: matches the catalogue server-side with a short debounce and
 * offers direct links to test pages.
 */
export function HomeSearch({ initial }: { initial: string }) {
  const seed = useRef<Suggestion[]>([])
  if (!seed.current.length) {
    try {
      seed.current = (JSON.parse(initial) as { tests: Suggestion[] }).tests.slice(0, 8)
    } catch { seed.current = [] }
  }
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Suggestion[]>(seed.current)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!term) { setResults(seed.current); return }
      setLoading(true)
      try {
        const response = await fetch(`/api/catalogue?q=${encodeURIComponent(term)}&pageSize=6`, { signal: controller.signal })
        const body = await response.json() as { tests: Suggestion[] }
        setResults(body.tests ?? [])
      } catch {
        // aborted or offline — keep the previous list
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  return (
    <div className="relative">
      <div className="card flex items-stretch gap-2 p-1.5">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="home-search" className="sr-only">Search diagnostic tests</label>
          <input
            id="home-search"
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}
            placeholder="Search for a test, e.g. thyroid, vitamin D, CBC"
            className="h-11 w-full bg-transparent pl-9 pr-3 text-[14px] outline-none placeholder:text-[#9aa8bd]"
            role="combobox"
            aria-expanded={open}
            aria-controls="home-search-results"
            aria-autocomplete="list"
          />
        </div>
        <Link href={query.trim() ? `/tests?q=${encodeURIComponent(query.trim())}` : '/tests'} className="btn btn-primary h-11">Search</Link>
      </div>

      {open && (
        <div id="home-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 card overflow-hidden shadow-card">
          <p className="border-b border-line px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wide text-muted">{query.trim() ? (loading ? 'Searching…' : 'Matching tests') : 'Popular tests'}</p>
          {results.length === 0 ? (
            <p className="px-3.5 py-4 text-[12.5px] text-muted">No tests match “{query}”. <Link href="/contact" className="link">Ask us about it</Link>.</p>
          ) : (
            <ul>
              {results.map((test) => (
                <li key={test.id} role="option" aria-selected="false">
                  <Link href={`/tests/${test.slug}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-page">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><MapPin size={13} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[12.5px] font-medium text-navy">{test.name}</b>
                      <span className="text-[10.5px] text-muted">{test.category}</span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums">{formatINR(test.pricePaise)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/tests" className="block border-t border-line px-3.5 py-2.5 text-[12px] font-semibold text-teal-700 hover:bg-teal-50/60">Browse the full catalogue →</Link>
        </div>
      )}
    </div>
  )
}
