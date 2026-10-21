'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { useCity } from '@/components/storefront/city-provider'

/** Location selector with a keyboard-dismissable dropdown of supported cities. */
export function LocationSelector() {
  const { city, setCity, cities } = useCity()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-section"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MapPin size={15} className="text-green" aria-hidden />
        <span className="max-w-[92px] truncate">{city.name}</span>
        <ChevronDown size={13} className={`text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          <p className="border-b border-line-soft px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted">Select your city</p>
          <ul role="listbox" aria-label="Supported cities" className="max-h-72 overflow-y-auto p-1.5">
            {cities.map((item) => {
              const selected = item.id === city.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { setCity(item); setOpen(false) }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${selected ? 'bg-mint-50' : 'hover:bg-section'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-semibold text-ink">{item.name}</b>
                      <span className="block truncate text-[11px] text-muted">
                        {item.state}{item.collecting ? ' · Home collection' : ' · Lab visit only'}
                      </span>
                    </span>
                    {selected && <Check size={15} className="shrink-0 text-mint-700" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
