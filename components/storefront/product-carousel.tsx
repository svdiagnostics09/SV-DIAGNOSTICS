'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard } from '@/components/storefront/product-card'
import type { StoreProduct } from '@/lib/storefront/product'

/**
 * Horizontal product carousel. Scroll-snap drives the native swipe on touch,
 * while the arrows and dots move by one card. Arrows disable at the ends and
 * the dots track whichever card is closest to the left edge.
 */
export function ProductCarousel({ products, label, emptyMessage }: {
  products: StoreProduct[]
  label: string
  emptyMessage?: string
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const first = track.firstElementChild as HTMLElement | null
    const step = first ? first.offsetWidth + 16 : 320
    const maxScroll = track.scrollWidth - track.clientWidth
    setCanLeft(track.scrollLeft > 8)
    setCanRight(track.scrollLeft < maxScroll - 8)
    setIndex(step > 0 ? Math.min(products.length - 1, Math.round(track.scrollLeft / step)) : 0)
  }, [products.length])

  useEffect(() => {
    measure()
    const track = trackRef.current
    if (!track) return
    track.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      track.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const scrollByCards = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const first = track.firstElementChild as HTMLElement | null
    const step = first ? first.offsetWidth + 16 : 320
    track.scrollBy({ left: step * direction, behavior: 'smooth' })
  }

  const goTo = (target: number) => {
    const track = trackRef.current
    if (!track) return
    const first = track.firstElementChild as HTMLElement | null
    const step = first ? first.offsetWidth + 16 : 320
    track.scrollTo({ left: step * target, behavior: 'smooth' })
  }

  if (products.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
        <p className="text-sm font-semibold text-forest">{emptyMessage ?? 'Nothing published here yet'}</p>
        <p className="mt-1 text-[13px] text-muted">Items appear as soon as they are published from the admin console.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          disabled={!canLeft}
          className="grid size-9 place-items-center rounded-full border border-line bg-white text-ink shadow-card transition hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Scroll ${label} left`}
        >
          <ChevronLeft size={17} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollByCards(1)}
          disabled={!canRight}
          className="grid size-9 place-items-center rounded-full border border-line bg-white text-ink shadow-card transition hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Scroll ${label} right`}
        >
          <ChevronRight size={17} aria-hidden />
        </button>
      </div>

      <ul
        ref={trackRef}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
        aria-label={label}
      >
        {products.map((product) => (
          <li key={`${product.kind}-${product.id}`} className="w-[78%] shrink-0 snap-start sm:w-[300px] lg:w-[calc((100%-2rem)/3)]">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      {products.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {products.map((product, dotIndex) => (
            <button
              key={`dot-${product.kind}-${product.id}`}
              type="button"
              onClick={() => goTo(dotIndex)}
              aria-label={`Go to card ${dotIndex + 1} of ${products.length}`}
              aria-current={dotIndex === index ? 'true' : undefined}
              className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-forest' : 'w-1.5 bg-line hover:bg-muted/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
