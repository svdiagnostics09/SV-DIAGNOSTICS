'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import type { Category, TestView } from '@/lib/catalogue'
import { formatINR } from '@/lib/format'
import { sampleLabel, turnaroundLabel } from '@/lib/labels'
import { EmptyState } from '@/components/ui'

/** Searchable price list. Same records and prices as the catalogue and checkout. */
export function PriceList({ tests, categories }: { tests: TestView[]; categories: Category[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tests.filter((test) =>
      (category === 'all' || test.categorySlug === category)
      && (!needle || `${test.name} ${test.shortDescription} ${test.sampleType}`.toLowerCase().includes(needle)),
    )
  }, [tests, query, category])

  const csv = () => {
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const content = [
      ['Test', 'Category', 'Sample type', 'Report time', 'Price (INR)', 'Home collection'].map(escape).join(','),
      ...rows.map((test) => [test.name, test.categoryName, sampleLabel(test.sampleType), turnaroundLabel(test.turnaroundHours), (test.listPricePaise / 100).toFixed(2), test.homeCollection ? 'Yes' : 'No'].map(escape).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `sv-diagnostics-price-list-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container-x py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="price-search" className="sr-only">Search the price list</label>
          <input id="price-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tests or sample type" className="input h-11 pl-10" />
        </div>
        <label htmlFor="price-category" className="sr-only">Category</label>
        <select id="price-category" value={category} onChange={(event) => setCategory(event.target.value)} className="input w-full sm:w-56">
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
        <button type="button" onClick={csv} disabled={rows.length === 0} className="btn btn-outline">
          <Download size={15} aria-hidden /> CSV
        </button>
      </div>

      <p className="mt-3 text-[13px] text-muted" aria-live="polite"><b className="text-ink">{rows.length}</b> {rows.length === 1 ? 'investigation' : 'investigations'} · prices include any configured discount</p>

      <div className="card mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Search} title="No matching investigations" description="Try another search term or category." />
        ) : (
          <div className="table-wrap">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <caption className="sr-only">SV Diagnostics published price list</caption>
              <thead>
                <tr className="border-b border-line bg-page text-[11px] uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Test</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Category</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Sample</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Report</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Price</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Book</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((test) => (
                  <tr key={test.id} className="hover:bg-page/70">
                    <td className="px-4 py-2.5">
                      <Link href={`/tests/${test.slug}`} className="font-semibold text-navy hover:text-teal-700">{test.name}</Link>
                      {test.homeCollection && <span className="badge badge-teal ml-2">Home</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{test.categoryName || '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{sampleLabel(test.sampleType)}</td>
                    <td className="px-4 py-2.5 text-muted">{turnaroundLabel(test.turnaroundHours)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <b className="text-navy">{formatINR(test.listPricePaise)}</b>
                      {test.listPricePaise < test.pricePaise && <del className="ml-1.5 text-[11.5px] text-muted">{formatINR(test.pricePaise)}</del>}
                    </td>
                    <td className="px-4 py-2.5 text-right"><Link href={`/tests/${test.slug}`} className="link text-[12.5px]">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11.5px] leading-5 text-muted">Prices are indicative and come directly from our published catalogue. The amount payable is always recalculated on the server when you confirm a booking. Please contact the laboratory for any test not listed here.</p>
    </div>
  )
}
