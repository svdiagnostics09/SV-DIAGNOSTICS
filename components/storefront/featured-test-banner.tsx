'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FlaskConical, Plus, Quote, Star, Clock3 } from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/format'
import { useCart } from '@/components/cart-provider'
import { useStoreUI } from '@/components/storefront/ui-provider'
import { discountPercent, type StoreProduct } from '@/lib/storefront/product'
import { IMAGES } from '@/lib/storefront/content'
import { turnaroundLabel } from '@/lib/labels'

/**
 * Split promotional section: a featured product card on the left, editorial
 * copy with a trust indicator on the right. Cycles through the featured tests.
 */
export function FeaturedTestBanner({ products }: { products: StoreProduct[] }) {
  const [index, setIndex] = useState(0)
  if (products.length === 0) return null

  const current = products[index % products.length]
  const off = discountPercent(current)
  const go = (direction: 1 | -1) => setIndex((value) => (value + direction + products.length) % products.length)

  return (
    <section className="bg-section section-y" aria-labelledby="featured-heading">
      <div className="container-x">
        <div className="flex items-center justify-between gap-3">
          <h2 id="featured-heading" className="section-heading">Featured diagnostic tests</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} className="grid size-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-green hover:text-green" aria-label="Previous featured test">
              <ChevronLeft size={17} aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} className="grid size-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-green hover:text-green" aria-label="Next featured test">
              <ChevronRight size={17} aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <FeaturedCard key={`${current.kind}-${current.id}`} product={current} off={off} />

          <div className="relative flex flex-col justify-center overflow-hidden rounded-card bg-white p-6 shadow-card sm:p-9">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-mint-50" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-3 py-1 text-[11.5px] font-semibold text-green">
                <FlaskConical size={12} aria-hidden /> {current.categoryName}
              </span>
              <h3 className="mt-3 text-[1.55rem] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[2rem]">
                Get your {current.name.replace(/^Complete\s+/i, '').replace(/\s*\([^)]*\)$/, '').toLowerCase()} levels tested
              </h3>
              <p className="mt-3 max-w-lg text-[14px] leading-6 text-muted">
                {current.description || 'Book a lab-verified panel with home collection and read your results on a secure digital report.'}
              </p>

              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink/75">
                {typeof current.parameterCount === 'number' && current.parameterCount > 0 && (
                  <li className="flex items-center gap-1.5"><FlaskConical size={14} className="text-green" aria-hidden /> {current.parameterCount} parameters</li>
                )}
                <li className="flex items-center gap-1.5"><Clock3 size={14} className="text-green" aria-hidden /> Report in {turnaroundLabel(current.turnaroundHours).toLowerCase()}</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-green" aria-hidden /> Home collection</li>
              </ul>

              <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint-50 text-mint-700"><Quote size={14} aria-hidden /></span>
                <div className="min-w-0">
                  <p className="flex items-center gap-0.5 text-orange" aria-label="Rated 4.9 out of 5">
                    {Array.from({ length: 5 }, (_, star) => <Star key={star} size={12} fill="currentColor" strokeWidth={0} aria-hidden />)}
                    <b className="ml-1.5 text-[11.5px] font-semibold text-ink">4.9</b>
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-4 text-muted">Based on sample feedback in this demo — not verified reviews.</p>
                </div>
                <div className="relative ml-auto hidden size-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white sm:block">
                  <Image src={IMAGES.consultation.src} alt={IMAGES.consultation.alt} fill sizes="56px" className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {products.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {products.map((product, dotIndex) => (
              <button
                key={`featured-dot-${product.kind}-${product.id}`}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Show featured test ${dotIndex + 1}`}
                aria-current={dotIndex === index ? 'true' : undefined}
                className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-forest' : 'w-1.5 bg-line hover:bg-muted/50'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function FeaturedCard({ product, off }: { product: StoreProduct; off: number }) {
  const cart = useCart()
  const { openProduct } = useStoreUI()
  const inCart = cart.has(product.kind, product.id)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div className="bg-tile-forest px-5 py-4 text-white">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold">
          <FlaskConical size={11} aria-hidden /> {product.kind === 'package' ? 'Health package' : 'Diagnostic test'}
        </span>
        <h3 className="mt-2 text-[16px] font-bold leading-snug text-white">{product.name}</h3>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <ul className="space-y-2 text-[12.5px] text-muted">
          <li className="flex items-center gap-2"><FlaskConical size={14} className="text-green" aria-hidden /> {product.parameterCount ? `${product.parameterCount} parameters included` : 'Comprehensive panel'}</li>
          <li className="flex items-center gap-2"><Clock3 size={14} className="text-green" aria-hidden /> Report in {turnaroundLabel(product.turnaroundHours).toLowerCase()}</li>
        </ul>

        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          <b className="text-[24px] font-bold tabular-nums text-ink">{formatINR(product.pricePaise)}</b>
          {off > 0 && <span className="price-was text-[13px]">{formatINR(product.listPricePaise)}</span>}
          {off > 0 && <span className="rounded-full bg-mint-50 px-2 py-0.5 text-[10.5px] font-bold text-mint-700">{off}% OFF</span>}
        </div>

        <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-2">
          <button type="button" onClick={() => openProduct(product)} className="btn btn-outline btn-sm">View Details</button>
          <button
            type="button"
            onClick={() => (inCart ? cart.remove(product.kind, product.id) : cart.add({ kind: product.kind, id: product.id, name: product.name, pricePaise: product.pricePaise, listPricePaise: product.listPricePaise, homeCollection: product.homeCollection }))}
            className={`btn btn-sm ${inCart ? 'btn-navy' : 'btn-primary'}`}
            aria-pressed={inCart}
          >
            {inCart ? <><Check size={13} aria-hidden /> Added</> : <><Plus size={13} aria-hidden /> Add to Cart</>}
          </button>
        </div>
        <Link href={product.kind === 'package' ? `/packages/${product.slug}` : `/tests/${product.slug}`} className="mt-2 text-center text-[11.5px] font-medium text-muted hover:text-green">
          Read the full details
        </Link>
      </div>
    </article>
  )
}
