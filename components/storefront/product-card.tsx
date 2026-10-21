'use client'

import Link from 'next/link'
import { Check, Clock3, FlaskConical, Home, Plus, ShieldCheck, Zap } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { useCart } from '@/components/cart-provider'
import { useStoreUI } from '@/components/storefront/ui-provider'
import { discountPercent, type StoreProduct } from '@/lib/storefront/product'
import { turnaroundLabel } from '@/lib/labels'

/**
 * Product card used by both carousels (checkups and lab tests).
 * Dark-green gradient header carries the category and discount; the white
 * body carries name, metadata and price; two actions sit at the bottom.
 */
export function ProductCard({ product, className }: { product: StoreProduct; className?: string }) {
  const cart = useCart()
  const { openProduct } = useStoreUI()
  const inCart = cart.has(product.kind, product.id)
  const off = discountPercent(product)
  const href = product.kind === 'package' ? `/packages/${product.slug}` : `/tests/${product.slug}`

  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-lift ${className ?? ''}`}>
      {/* Gradient header */}
      <div className="bg-tile-forest px-4 pb-3.5 pt-3.5 text-white">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">
            {product.kind === 'package' ? <ShieldCheck size={11} aria-hidden /> : <FlaskConical size={11} aria-hidden />}
            {product.kind === 'package' ? 'Health package' : product.categoryName}
          </span>
          {off > 0 && <span className="rounded-full bg-orange px-2 py-0.5 text-[10.5px] font-bold text-white">{off}% OFF</span>}
        </div>
        <h3 className="mt-2.5 line-clamp-2 min-h-[2.6rem] text-[15px] font-bold leading-snug text-white">
          <Link href={href} className="hover:underline">{product.name}</Link>
        </h3>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <ul className="space-y-1.5 text-[12px] text-muted">
          {typeof product.parameterCount === 'number' && product.parameterCount > 0 && (
            <li className="flex items-center gap-1.5"><FlaskConical size={13} className="text-green" aria-hidden /> {product.parameterCount} {product.kind === 'package' ? 'test' : 'parameter'}{product.parameterCount === 1 ? '' : 's'} included</li>
          )}
          <li className="flex items-center gap-1.5"><Clock3 size={13} className="text-green" aria-hidden /> Report in {turnaroundLabel(product.turnaroundHours).toLowerCase()}</li>
          {product.homeCollection && <li className="flex items-center gap-1.5"><Home size={13} className="text-green" aria-hidden /> Home collection available</li>}
        </ul>

        <div className="mt-3 border-t border-line-soft pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <b className="text-[19px] font-bold tabular-nums text-ink">{formatINR(product.pricePaise)}</b>
            {off > 0 && <span className="price-was text-[12.5px]">{formatINR(product.listPricePaise)}</span>}
          </div>
          {off > 0 && <p className="mt-0.5 flex items-center gap-1 text-[11.5px] price-off"><Zap size={11} aria-hidden /> You save {formatINR(product.listPricePaise - product.pricePaise)}</p>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
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
      </div>
    </article>
  )
}
