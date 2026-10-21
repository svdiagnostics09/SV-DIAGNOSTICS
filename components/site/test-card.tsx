'use client'

import Link from 'next/link'
import { Clock3, FlaskConical, Home, Plus, Check } from 'lucide-react'
import { formatINR } from '@/lib/format'
import type { TestView } from '@/lib/catalogue'
import { useCart } from '@/components/cart-provider'
import { sampleLabel, turnaroundLabel } from '@/lib/labels'

export function TestCard({ test }: { test: TestView }) {
  const cart = useCart()
  const inCart = cart.has('test', test.id)
  const discounted = test.listPricePaise < test.pricePaise

  return (
    <article className="card group flex h-full flex-col p-4 pb-5 transition hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-lift">
      <div className="plate mb-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
        <span className="badge badge-gray bg-white">{test.categoryName || 'Diagnostic test'}</span>
        {test.isPopular && <span className="badge badge-teal">Popular</span>}
      </div>
      <h3 className="text-[14.5px] font-bold leading-snug text-navy">
        <Link href={`/tests/${test.slug}`} className="hover:text-teal-700">{test.name}</Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[12.5px] leading-5 text-muted">{test.shortDescription || test.description || test.preparation || 'Diagnostic test at SV Diagnostics.'}</p>

      <dl className="mt-3 space-y-1.5 text-[12px] text-muted">
        <div className="flex items-center gap-1.5"><FlaskConical size={13} className="text-muted" aria-hidden /><dt className="sr-only">Sample</dt><dd className="truncate">{sampleLabel(test.sampleType)}</dd></div>
        <div className="flex items-center gap-1.5"><Clock3 size={13} className="text-muted" aria-hidden /><dt className="sr-only">Report time</dt><dd>{turnaroundLabel(test.turnaroundHours)}</dd></div>
        {test.homeCollection && <div className="flex items-center gap-1.5 text-teal-700"><Home size={13} aria-hidden /><dt className="sr-only">Home collection</dt><dd>Home collection available</dd></div>}
      </dl>

      <div className="mt-auto border-t border-line-soft pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <b className="text-[18px] font-bold text-navy tabular-nums">{formatINR(test.listPricePaise)}</b>
          {discounted && <del className="text-[12px] text-muted tabular-nums">{formatINR(test.pricePaise)}</del>}
          {test.discountType === 'percent' && test.discountValue > 0 && <span className="badge badge-teal">{test.discountValue}% off</span>}
          {test.discountType === 'amount' && test.discountValue > 0 && <span className="badge badge-teal">{formatINR(test.discountValue)} off</span>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link href={`/tests/${test.slug}`} className="btn btn-outline btn-sm flex-1">View</Link>
          <button
            type="button"
            onClick={() => cart.toggle({ kind: 'test', id: test.id, name: test.name, pricePaise: test.listPricePaise, homeCollection: test.homeCollection })}
            className={`btn btn-sm ${inCart ? 'btn-navy' : 'btn-primary'}`}
            aria-pressed={inCart}
          >
            {inCart ? <><Check size={13} aria-hidden /> Added</> : <><Plus size={13} aria-hidden /> Book</>}
          </button>
        </div>
      </div>
    </article>
  )
}
