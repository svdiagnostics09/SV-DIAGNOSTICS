'use client'

import Link from 'next/link'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { useCart } from '@/components/cart-provider'
import { useStoreUI } from '@/components/storefront/ui-provider'
import { discountPercent } from '@/lib/storefront/product'
import { Overlay } from '@/components/storefront/overlay'

/** Slide-over cart: quantity steppers, remove, subtotal and checkout CTA. */
export function CartDrawer() {
  const cart = useCart()
  const { cartOpen, closeCart, openBooking } = useStoreUI()

  const listTotal = cart.items.reduce((sum, item) => sum + (item.listPricePaise ?? item.pricePaise) * (item.quantity ?? 1), 0)
  const saving = Math.max(0, listTotal - cart.subtotalPaise)

  return (
    <Overlay open={cartOpen} onClose={closeCart} labelledBy="cart-title" side="right">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="cart-title" className="text-[15px] font-bold text-ink">Your booking</h2>
          <p className="text-[11.5px] text-muted">
            {cart.ready ? (cart.count === 0 ? 'No tests added yet' : `${cart.count} item${cart.count === 1 ? '' : 's'} selected`) : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cart.count === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-mint-50 text-mint-700"><ShoppingBag size={24} aria-hidden /></span>
            <p className="mt-3 text-[14px] font-semibold text-ink">Your cart is empty</p>
            <p className="mt-1 max-w-[240px] text-[12.5px] leading-5 text-muted">Add a test or checkup to start a booking.</p>
            <Link href="/tests" onClick={closeCart} className="btn btn-primary btn-sm mt-4">Browse tests</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {cart.items.map((item) => {
              const quantity = item.quantity ?? 1
              const off = discountPercent({ pricePaise: item.pricePaise, listPricePaise: item.listPricePaise ?? item.pricePaise })
              return (
                <li key={`${item.kind}-${item.id}`} className="rounded-tile border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="badge badge-gray">{item.kind === 'package' ? 'Checkup' : 'Lab test'}</span>
                      <b className="mt-1.5 block text-[13px] font-semibold leading-snug text-ink">{item.name}</b>
                    </div>
                    <button
                      type="button"
                      onClick={() => cart.remove(item.kind, item.id)}
                      className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-danger"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-full border border-line">
                      <button
                        type="button"
                        onClick={() => cart.setQuantity(item.kind, item.id, quantity - 1)}
                        disabled={quantity <= 1}
                        className="grid size-7 place-items-center rounded-full text-ink transition hover:bg-section disabled:opacity-40"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus size={12} aria-hidden />
                      </button>
                      <span className="min-w-4 text-center text-[12px] font-semibold tabular-nums" aria-live="polite">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => cart.setQuantity(item.kind, item.id, quantity + 1)}
                        disabled={quantity >= 10}
                        className="grid size-7 place-items-center rounded-full text-ink transition hover:bg-section disabled:opacity-40"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus size={12} aria-hidden />
                      </button>
                    </div>

                    <div className="text-right">
                      <b className="block text-[13px] font-bold tabular-nums text-ink">{formatINR(item.pricePaise * quantity)}</b>
                      {off > 0 && (
                        <span className="text-[10.5px] price-off">
                          {formatINR((item.listPricePaise ?? item.pricePaise) * quantity)} · {off}% off
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {cart.count > 0 && (
        <div className="border-t border-line bg-surface px-5 py-4">
          <dl className="space-y-1.5 text-[12.5px]">
            {saving > 0 && (
              <>
                <div className="flex justify-between text-muted"><dt>List price</dt><dd className="tabular-nums line-through">{formatINR(listTotal)}</dd></div>
                <div className="flex justify-between text-mint-700"><dt>Discount</dt><dd className="tabular-nums">− {formatINR(saving)}</dd></div>
              </>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-[14px] font-bold text-ink">
              <dt>Subtotal</dt><dd className="tabular-nums">{formatINR(cart.subtotalPaise)}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-[11px] leading-4 text-muted">Home collection fees, if any, are shown at the next step.</p>
          <button type="button" onClick={() => openBooking(null)} className="btn btn-primary mt-3 w-full">
            Continue to booking
          </button>
          <Link href="/book" onClick={closeCart} className="mt-2 block text-center text-[11.5px] font-medium text-muted hover:text-green">
            Open the full booking form
          </Link>
        </div>
      )}
    </Overlay>
  )
}
