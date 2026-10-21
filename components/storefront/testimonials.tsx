'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, HeartPulse, PhoneCall, Star } from 'lucide-react'
import { useState } from 'react'
import { TESTIMONIALS, TESTIMONIAL_DISCLAIMER } from '@/lib/storefront/content'

const GOOGLE_RATING = 4.9

/** Testimonials carousel with a clearly-labelled sample disclaimer. */
export function Testimonials() {
  const [start, setStart] = useState(0)
  const pageSize = 3
  const pages = Math.ceil(TESTIMONIALS.length / pageSize)
  const move = (direction: 1 | -1) => setStart((value) => (value + direction + pages) % pages)
  const visible = TESTIMONIALS.slice(start * pageSize, start * pageSize + pageSize)

  return (
    <section className="section-y" aria-labelledby="reviews-heading">
      <div className="container-x">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Customer reviews</span>
            <h2 id="reviews-heading" className="section-heading mt-1.5">What patients say</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-0.5 text-orange" aria-hidden>
                {Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill="currentColor" strokeWidth={0} />)}
              </span>
              <b className="text-[14px] font-bold text-ink">{GOOGLE_RATING}</b>
              <span className="text-[12.5px] text-muted">Google Rating</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => move(-1)} className="grid size-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-green hover:text-green" aria-label="Previous reviews">
              <ChevronLeft size={17} aria-hidden />
            </button>
            <button type="button" onClick={() => move(1)} className="grid size-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-green hover:text-green" aria-label="Next reviews">
              <ChevronRight size={17} aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((review) => (
            <figure key={review.id} className="flex h-full flex-col rounded-card border border-line bg-white p-5 shadow-card">
              <div className="flex items-center gap-0.5 text-orange" aria-label={`Rated ${review.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} strokeWidth={1.5} aria-hidden />
                ))}
              </div>
              <blockquote className="mt-2.5 flex-1 text-[13px] leading-6 text-ink/80">“{review.quote}”</blockquote>
              <figcaption className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
                <span className="grid size-8 place-items-center rounded-full bg-mint-50 text-[11px] font-bold text-mint-700">{review.name.slice(0, 1)}</span>
                <span>
                  <b className="block text-[12px] font-semibold text-ink">{review.name}</b>
                  <span className="text-[10.5px] text-muted">{review.city}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-section px-3 py-2 text-[11px] leading-5 text-muted">
          <HeartPulse size={13} className="mt-0.5 shrink-0" aria-hidden />
          {TESTIMONIAL_DISCLAIMER}
        </p>
      </div>

      <div className="container-x mt-6">
        <div className="flex flex-col items-center justify-between gap-3 rounded-card border border-line bg-white p-5 shadow-card sm:flex-row">
          <div>
            <b className="block text-[14px] font-bold text-ink">Still deciding which checkup to book?</b>
            <span className="text-[12.5px] text-muted">Our support team can help you choose based on your needs.</span>
          </div>
          <Link href="/contact" className="btn btn-outline-green btn-sm shrink-0">
            <PhoneCall size={14} aria-hidden /> Talk to support
          </Link>
        </div>
      </div>
    </section>
  )
}
