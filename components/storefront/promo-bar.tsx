'use client'

import { ArrowRight } from 'lucide-react'
import { useStoreUI } from '@/components/storefront/ui-provider'
import { useCity } from '@/components/storefront/city-provider'

/**
 * Dark-green promotional strip above the header. Text comes from business
 * settings so the admin console controls what is announced.
 */
export function PromoBar({ message, offerLabel, offerPrice }: {
  message: string
  offerLabel: string
  offerPrice: string
}) {
  const { openBooking } = useStoreUI()
  const { city } = useCity()

  return (
    <div className="bg-forest text-white">
      <div className="container-x flex min-h-10 flex-wrap items-center justify-center gap-x-2.5 gap-y-1 py-2 text-center text-[12px] sm:text-[12.5px]">
        <span className="truncate text-white/90">{message}</span>
        <span className="hidden items-center gap-1.5 lg:inline-flex">
          <span className="h-3 w-px bg-white/25" aria-hidden />
          <span className="font-semibold text-white">{offerLabel}</span>
          <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-bold text-forest">{offerPrice}</span>
        </span>
        <button
          type="button"
          onClick={() => openBooking(null)}
          className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-orange px-3 py-1 text-[11.5px] font-bold text-white transition hover:bg-orange-600"
        >
          Order Now <ArrowRight size={12} aria-hidden />
        </button>
        <span className="sr-only">Available in {city.name}</span>
      </div>
    </div>
  )
}
