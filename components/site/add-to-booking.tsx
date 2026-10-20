'use client'

import Link from 'next/link'
import { Check, Plus, ShoppingBag } from 'lucide-react'
import { useCart, type CartEntry } from '@/components/cart-provider'

/** Add-to-booking control with an immediate link to the cart. */
export function AddToBooking({ entry, className }: { entry: CartEntry; className?: string }) {
  const cart = useCart()
  const added = cart.has(entry.kind, entry.id)

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => cart.toggle(entry)}
        className={`btn btn-lg w-full ${added ? 'btn-navy' : 'btn-primary'}`}
        aria-pressed={added}
        disabled={!cart.ready}
      >
        {added ? <><Check size={17} aria-hidden /> Added to booking</> : <><Plus size={17} aria-hidden /> Add to booking</>}
      </button>
      {added && (
        <Link href="/book" className="btn btn-outline mt-2 w-full">
          <ShoppingBag size={16} aria-hidden /> Review booking ({cart.count})
        </Link>
      )}
    </div>
  )
}
