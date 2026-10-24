'use client'

import { Crosshair, Loader2, MapPin, TriangleAlert } from 'lucide-react'
import { useCallback, useState } from 'react'

/**
 * "Use my current location" for the home-collection address step.
 *
 * The browser gives us coordinates; to get a pincode and street back we need a
 * reverse-geocoding pass. Two providers, tried in order:
 *
 *  1. Google Geocoding API — used when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
 *     This is the accurate one for Indian addresses.
 *  2. BigDataCloud's keyless public endpoint — good enough to pre-fill a
 *     pincode (it returns `postcode`) when no Google key is configured.
 *
 * Either way the customer can still correct what we filled in, and if geolocation
 * is denied or unsupported we leave the manual fields untouched.
 */

export interface LocatedAddress {
  pincode: string
  addressLine: string
  area: string
  latitude: number
  longitude: number
}

interface GoogleResult {
  results?: Array<{
    formatted_address?: string
    address_components?: Array<{ long_name: string; types: string[] }>
  }>
  status?: string
}

function pick(components: Array<{ long_name: string; types: string[] }> | undefined, ...types: string[]) {
  for (const type of types) {
    const hit = components?.find((component) => component.types.includes(type))
    if (hit) return hit.long_name
  }
  return ''
}

async function googleReverse(lat: number, lon: number, key: string): Promise<LocatedAddress | null> {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${encodeURIComponent(key)}&result_type=street_address|premise|subpremise|route|sublocality|postal_code`,
  )
  if (!response.ok) return null
  const data = (await response.json()) as GoogleResult
  const result = data.results?.[0]
  if (!result) return null
  const components = result.address_components
  const streetNumber = pick(components, 'street_number')
  const route = pick(components, 'route') || pick(components, 'sublocality_level_1')
  return {
    pincode: pick(components, 'postal_code').replace(/\D/g, '').slice(0, 6),
    addressLine: [streetNumber, route].filter(Boolean).join(', ') || (result.formatted_address ?? '').split(',')[0] || '',
    area: pick(components, 'sublocality_level_2', 'sublocality_level_1', 'locality', 'neighborhood'),
    latitude: lat,
    longitude: lon,
  }
}

async function keylessReverse(lat: number, lon: number): Promise<LocatedAddress | null> {
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  )
  if (!response.ok) return null
  const data = await response.json() as {
    postcode?: string
    locality?: string
    city?: string
    principalSubdivision?: string
    localityInfo?: { administrative?: Array<{ name: string; order?: number }> }
  }
  const area = data.locality || data.city || ''
  return {
    pincode: (data.postcode ?? '').replace(/\D/g, '').slice(0, 6),
    addressLine: '',
    area,
    latitude: lat,
    longitude: lon,
  }
}

export function UseMyLocation({ onLocated, disabled }: {
  onLocated: (address: LocatedAddress) => void
  disabled?: boolean
}) {
  const [phase, setPhase] = useState<'idle' | 'locating' | 'resolving'>('idle')
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setError('')
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('This browser cannot share a location. Enter your address manually.')
      return
    }
    setPhase('locating')
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (found) => resolve(found),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      )
    })
    if (!position) {
      setPhase('idle')
      setError('We could not get your location. Allow location access, or enter your address manually.')
      return
    }

    setPhase('resolving')
    const { latitude, longitude } = position.coords
    try {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
      const address = (key ? await googleReverse(latitude, longitude, key) : null)
        ?? await keylessReverse(latitude, longitude)
      if (!address || (!address.pincode && !address.area)) {
        setPhase('idle')
        setError('We found your position but could not read the address. Please type your pincode.')
        return
      }
      onLocated(address)
      setPhase('idle')
    } catch {
      setPhase('idle')
      setError('Address lookup failed. Check your connection or enter the address manually.')
    }
  }, [onLocated])

  const busy = phase !== 'idle'

  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || disabled}
        className="btn btn-outline btn-sm"
      >
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Crosshair size={13} aria-hidden />}
        {phase === 'locating' ? 'Finding you…' : phase === 'resolving' ? 'Reading address…' : 'Use my current location'}
      </button>
      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-5 text-danger" role="alert">
          <TriangleAlert size={12} className="mt-1 shrink-0" aria-hidden /> {error}
        </p>
      )}
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
        <MapPin size={11} className="shrink-0" aria-hidden />
        We use your location only to fill this address.
      </p>
    </div>
  )
}
