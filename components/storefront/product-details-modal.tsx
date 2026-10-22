'use client'

import Link from 'next/link'
import { Check, Clock3, FlaskConical, Home, Info, Plus, ShieldCheck, Zap } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { turnaroundLabel, sampleLabel } from '@/lib/labels'
import { useCart } from '@/components/cart-provider'
import { useStoreUI } from '@/components/storefront/ui-provider'
import { discountPercent } from '@/lib/storefront/product'
import { Overlay } from '@/components/storefront/overlay'

/** Product quick-view dialog shared by every card and search result. */
export function ProductDetailsModal() {
  const { product, closeProduct } = useStoreUI()
  const cart = useCart()
  const inCart = product ? cart.has(product.kind, product.id) : false
  const off = product ? discountPercent(product) : 0

  return (
    <Overlay open={Boolean(product)} onClose={closeProduct} labelledBy="product-title" className="max-w-xl">
      {product && (
        <>
          <div className="bg-tile-forest px-5 pb-5 pt-6 text-white sm:px-6">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold">
              {product.kind === 'package' ? <ShieldCheck size={11} aria-hidden /> : <FlaskConical size={11} aria-hidden />}
              {product.kind === 'package' ? 'Health package' : product.categoryName}
            </span>
            <h2 id="product-title" className="mt-2 pr-8 text-[18px] font-bold leading-snug text-white sm:text-[20px]">{product.name}</h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <b className="text-[22px] font-bold tabular-nums">{formatINR(product.pricePaise)}</b>
              {off > 0 && <span className="text-[13px] text-white/60 line-through tabular-nums">{formatINR(product.listPricePaise)}</span>}
              {off > 0 && <span className="rounded-full bg-orange px-2 py-0.5 text-[10.5px] font-bold text-white">{off}% OFF</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            {product.description && <p className="text-[13px] leading-6 text-ink/80">{product.description}</p>}
            {product.detail && product.detail !== product.description && (
              <p className="mt-2 text-[13px] leading-6 text-muted">{product.detail}</p>
            )}

            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                ['Report time', `In ${turnaroundLabel(product.turnaroundHours).toLowerCase()}`],
                ['Sample', product.sampleType ? sampleLabel(product.sampleType) : 'Confirmed at booking'],
                ['Parameters', product.parameterCount ? `${product.parameterCount} included` : 'Listed on the report'],
                ['Collection', product.homeCollection ? 'Home collection available' : 'Lab visit required'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-0.5 text-[12.5px] font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            {product.preparation && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-[12px] leading-5 text-[#8a4b00]">
                <Info size={14} className="mt-0.5 shrink-0" aria-hidden /> {product.preparation}
              </p>
            )}

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
              <li className="flex items-center gap-1"><Clock3 size={12} className="text-green" aria-hidden /> Reports on your booking page</li>
              {product.homeCollection && <li className="flex items-center gap-1"><Home size={12} className="text-green" aria-hidden /> Trained collector</li>}
              {off > 0 && <li className="flex items-center gap-1 price-off"><Zap size={12} aria-hidden /> Save {formatINR(product.listPricePaise - product.pricePaise)}</li>}
            </ul>
          </div>

          <div className="grid gap-2 border-t border-line bg-white px-5 py-4 sm:grid-cols-2 sm:px-6">
            <button
              type="button"
              onClick={() => {
                if (inCart) cart.remove(product.kind, product.id)
                else cart.add({ kind: product.kind, id: product.id, name: product.name, pricePaise: product.pricePaise, listPricePaise: product.listPricePaise, homeCollection: product.homeCollection })
              }}
              className={`btn ${inCart ? 'btn-outline' : 'btn-primary'}`}
            >
              {inCart ? <><Check size={15} aria-hidden /> Added to cart</> : <><Plus size={15} aria-hidden /> Add to Cart</>}
            </button>
            <Link
              href={product.kind === 'package' ? `/book?package=${product.id}` : `/book?test=${product.id}`}
              onClick={closeProduct}
              className="btn btn-navy"
            >
              Book this now
            </Link>
            <Link
              href={product.kind === 'package' ? `/packages/${product.slug}` : `/tests/${product.slug}`}
              onClick={closeProduct}
              className="text-center text-[11.5px] font-medium text-muted hover:text-green sm:col-span-2"
            >
              View the full {product.kind === 'package' ? 'package' : 'test'} page →
            </Link>
          </div>
        </>
      )}
    </Overlay>
  )
}
