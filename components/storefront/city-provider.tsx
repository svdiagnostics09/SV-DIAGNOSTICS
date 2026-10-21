'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CITIES, DEFAULT_CITY, type City } from '@/lib/storefront/content'

interface CityContext {
  city: City
  setCity: (city: City) => void
  cities: City[]
  ready: boolean
}

const Context = createContext<CityContext | null>(null)
const STORAGE_KEY = 'sv-city-v1'

/**
 * Selected city, persisted locally. Starts at the server default so the first
 * render is deterministic, then adopts the stored choice after mount.
 */
export function CityProvider({ initialCity = DEFAULT_CITY, children }: { initialCity?: City; children: React.ReactNode }) {
  const [city, setCityState] = useState<City>(initialCity)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const storedId = window.localStorage.getItem(STORAGE_KEY)
      const match = CITIES.find((item) => item.id === storedId)
      if (match) setCityState(match)
    } catch {
      // storage unavailable — keep the default
    }
    setReady(true)
  }, [])

  const setCity = useCallback((next: City) => {
    setCityState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next.id) } catch { /* ignore */ }
  }, [])

  const value = useMemo<CityContext>(() => ({ city, setCity, cities: CITIES, ready }), [city, setCity, ready])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCity() {
  const context = useContext(Context)
  if (!context) throw new Error('useCity must be used inside CityProvider')
  return context
}
