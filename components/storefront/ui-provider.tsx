'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'


// The product type and mappers live in a server-safe module so pages can call them.
import type { StoreProduct } from '@/lib/storefront/product'

export type { StoreProduct }

interface StoreUIContext {
  /** Details modal target, or null when closed. */
  product: StoreProduct | null
  openProduct: (product: StoreProduct) => void
  closeProduct: () => void
  cartOpen: boolean
  openCart: () => void
  closeCart: () => void
  /** Booking modal target (null = general booking), or null when closed. */
  booking: StoreProduct | null
  /** Whether the booking modal is open (distinct from ``booking === null``). */
  bookingOpen: boolean
  openBooking: (product?: StoreProduct | null) => void
  closeBooking: () => void
}

const Context = createContext<StoreUIContext | null>(null)

/**
 * Coordinates the three overlays (details / cart / booking) so they never stack
 * on top of each other. The cart itself lives in CartProvider.
 */
export function StoreUIProvider({ children }: { children: React.ReactNode }) {
  const [product, setProduct] = useState<StoreProduct | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [booking, setBooking] = useState<StoreProduct | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)

  const openProduct = useCallback((next: StoreProduct) => {
    setCartOpen(false)
    setProduct(next)
  }, [])

  const openCart = useCallback(() => {
    setProduct(null)
    setCartOpen(true)
  }, [])

  const openBooking = useCallback((next?: StoreProduct | null) => {
    setProduct(null)
    setCartOpen(false)
    setBooking(next ?? null)
    setBookingOpen(true)
  }, [])

  const value = useMemo<StoreUIContext>(() => ({
    product,
    openProduct,
    closeProduct: () => setProduct(null),
    cartOpen,
    openCart,
    closeCart: () => setCartOpen(false),
    booking: bookingOpen ? booking : null,
    bookingOpen,
    openBooking,
    closeBooking: () => { setBookingOpen(false); setBooking(null) },
  }), [product, openProduct, cartOpen, openCart, booking, bookingOpen, openBooking])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useStoreUI() {
  const context = useContext(Context)
  if (!context) throw new Error('useStoreUI must be used inside StoreUIProvider')
  return context
}
