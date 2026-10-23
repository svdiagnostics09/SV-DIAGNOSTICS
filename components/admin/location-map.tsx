'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, MapPin, Navigation } from 'lucide-react'

/**
 * Google Maps preview for a location.
 *
 * The embed key is public by design (it is restricted by HTTP referrer in the
 * Google Cloud console), so it can live in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 * Without a key we still render a working map: the plain Google Maps embed
 * takes a `q=` search, which is enough to show the store and open directions.
 */

export function mapsQueryFor(location: { name: string; addressLine1?: string; area?: string; city?: string; pincode?: string }) {
  return [location.name, location.addressLine1, location.area, location.city, location.pincode]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

/** "Directions" URL: opens the Google Maps app on a phone, Maps on desktop. */
export function directionsUrl(location: { name: string; addressLine1?: string; area?: string; city?: string; pincode?: string; mapsUrl?: string }) {
  const explicit = (location.mapsUrl ?? '').trim()
  if (explicit) {
    // A pasted /maps/place/… link already carries the exact pin.
    return explicit.includes('google.') ? explicit : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(explicit)}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQueryFor(location))}`
}

export function LocationMap({ location, height = 280 }: {
  location: { name: string; addressLine1?: string; addressLine2?: string; area?: string; city?: string; pincode?: string; mapsUrl?: string }
  height?: number
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const query = mapsQueryFor(location)
  const directions = useMemo(() => directionsUrl(location), [location])
  // Remount the iframe only when the address or key actually changes.
  const [src, setSrc] = useState('')

  useEffect(() => {
    const next = key
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&zoom=15`
      : `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`
    setSrc(next)
  }, [key, query])

  if (!query) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed border-line bg-surface p-6 text-center text-[12px] text-muted" style={{ height }}>
        Fill in the address to preview the map.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="relative bg-surface" style={{ height }}>
        {src && (
          <iframe
            title={`Map of ${location.name}`}
            src={src}
            className="size-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
        {!key && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[10.5px] text-muted shadow-sm">
            Basic map · add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the styled embed
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-3 py-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted">
          <MapPin size={12} className="shrink-0" aria-hidden />
          <span className="truncate">{query}</span>
        </p>
        <div className="flex shrink-0 gap-1.5">
          <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            <Navigation size={13} aria-hidden /> Directions
          </a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            Open in Maps <ExternalLink size={12} aria-hidden />
          </a>
        </div>
      </div>
    </div>
  )
}
