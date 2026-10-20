'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export interface CartEntry {
  kind: 'test' | 'package'
  id: number
  name: string
  pricePaise: number
  homeCollection: boolean
}

interface CartContext {
  items: CartEntry[]
  add: (entry: CartEntry) => void
  remove: (kind: CartEntry['kind'], id: number) => void
  toggle: (entry: CartEntry) => void
  clear: () => void
  has: (kind: CartEntry['kind'], id: number) => boolean
  count: number
  subtotalPaise: number
  ready: boolean
}

const Context = createContext<CartContext | null>(null)
const STORAGE_KEY = 'sv-cart-v1'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartEntry[]>([])
  const [ready, setReady] = useState(false)

  // Hydrate after mount so server and client markup match.
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as CartEntry[]
      if (Array.isArray(stored)) setItems(stored.filter((item) => item && (item.kind === 'test' || item.kind === 'package') && typeof item.id === 'number').slice(0, 12))
    } catch {
      // corrupted storage is simply ignored
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  const add = useCallback((entry: CartEntry) => {
    setItems((current) => (current.some((item) => item.kind === entry.kind && item.id === entry.id) || current.length >= 12 ? current : [...current, entry]))
  }, [])

  const remove = useCallback((kind: CartEntry['kind'], id: number) => {
    setItems((current) => current.filter((item) => !(item.kind === kind && item.id === id)))
  }, [])

  const toggle = useCallback((entry: CartEntry) => {
    setItems((current) => current.some((item) => item.kind === entry.kind && item.id === entry.id)
      ? current.filter((item) => !(item.kind === entry.kind && item.id === entry.id))
      : current.length >= 12 ? current : [...current, entry])
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContext>(() => ({
    items,
    add,
    remove,
    toggle,
    clear,
    has: (kind, id) => items.some((item) => item.kind === kind && item.id === id),
    count: items.length,
    subtotalPaise: items.reduce((sum, item) => sum + item.pricePaise, 0),
    ready,
  }), [items, add, remove, toggle, clear, ready])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCart() {
  const context = useContext(Context)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
