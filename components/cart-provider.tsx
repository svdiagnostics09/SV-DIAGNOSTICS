'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export interface CartEntry {
  kind: 'test' | 'package'
  id: number
  name: string
  /** Unit price in paise (already discounted where a discount applies). */
  pricePaise: number
  /** Undiscounted price, for showing the saving in the drawer. */
  listPricePaise?: number
  homeCollection: boolean
  /** Quantity, 1–10. Older stored carts without it hydrate to 1. */
  quantity?: number
}

interface CartContext {
  items: CartEntry[]
  add: (entry: CartEntry, quantity?: number) => void
  remove: (kind: CartEntry['kind'], id: number) => void
  toggle: (entry: CartEntry) => void
  setQuantity: (kind: CartEntry['kind'], id: number, quantity: number) => void
  clear: () => void
  has: (kind: CartEntry['kind'], id: number) => boolean
  quantityOf: (kind: CartEntry['kind'], id: number) => number
  count: number
  subtotalPaise: number
  ready: boolean
}

const Context = createContext<CartContext | null>(null)
const STORAGE_KEY = 'sv-cart-v1'
const MAX_LINES = 12
const MAX_QTY = 10

const clampQty = (value: number) => Math.min(MAX_QTY, Math.max(1, Math.round(value) || 1))

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartEntry[]>([])
  const [ready, setReady] = useState(false)

  // Hydrate after mount so server and client markup match.
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as CartEntry[]
      if (Array.isArray(stored)) {
        setItems(
          stored
            .filter((item) => item && (item.kind === 'test' || item.kind === 'package') && typeof item.id === 'number')
            .slice(0, MAX_LINES)
            .map((item) => ({ ...item, quantity: clampQty(item.quantity ?? 1) })),
        )
      }
    } catch {
      // corrupted storage is simply ignored
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  const add = useCallback((entry: CartEntry, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.kind === entry.kind && item.id === entry.id)
      if (existing) {
        return current.map((item) =>
          item.kind === entry.kind && item.id === entry.id
            ? { ...item, quantity: clampQty((item.quantity ?? 1) + quantity) }
            : item,
        )
      }
      if (current.length >= MAX_LINES) return current
      return [...current, { ...entry, quantity: clampQty(quantity) }]
    })
  }, [])

  const remove = useCallback((kind: CartEntry['kind'], id: number) => {
    setItems((current) => current.filter((item) => !(item.kind === kind && item.id === id)))
  }, [])

  const toggle = useCallback((entry: CartEntry) => {
    setItems((current) =>
      current.some((item) => item.kind === entry.kind && item.id === entry.id)
        ? current.filter((item) => !(item.kind === entry.kind && item.id === entry.id))
        : current.length >= MAX_LINES
          ? current
          : [...current, { ...entry, quantity: clampQty(entry.quantity ?? 1) }],
    )
  }, [])

  const setQuantity = useCallback((kind: CartEntry['kind'], id: number, quantity: number) => {
    setItems((current) => current.map((item) => (item.kind === kind && item.id === id ? { ...item, quantity: clampQty(quantity) } : item)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContext>(() => ({
    items,
    add,
    remove,
    toggle,
    setQuantity,
    clear,
    has: (kind, id) => items.some((item) => item.kind === kind && item.id === id),
    quantityOf: (kind, id) => items.find((item) => item.kind === kind && item.id === id)?.quantity ?? 0,
    count: items.length,
    subtotalPaise: items.reduce((sum, item) => sum + item.pricePaise * (item.quantity ?? 1), 0),
    ready,
  }), [items, add, remove, toggle, setQuantity, clear, ready])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCart() {
  const context = useContext(Context)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
