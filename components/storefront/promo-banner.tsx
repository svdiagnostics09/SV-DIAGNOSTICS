'use client'

import { useState } from 'react'
import { Apple, Dna, Dumbbell, Leaf } from 'lucide-react'
import { useStoreUI } from '@/components/storefront/ui-provider'

const SLIDES = [
  { id: 'nutridna', title: 'NutriDNA Test', description: 'One test to decode your nutrition, fitness, and metabolism.' },
  { id: 'fullbody', title: 'Full Body Checkup', description: 'Essential screening across the parameters that matter most year to year.' },
  { id: 'thyroid', title: 'Thyroid Function Test', description: 'A clear picture of how your thyroid is working, from a single sample.' },
]

/**
 * Wide promotional banner with a nutrition theme. The DNA artwork is drawn in
 * SVG so it stays crisp at every size and adds no image weight.
 */
export function PromoBanner() {
  const { openBooking } = useStoreUI()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]

  return (
    <section className="container-x pb-2 pt-8 sm:pt-10">
      <div className="relative overflow-hidden rounded-[24px] border border-[#f1e7d8] bg-[#fdf8f0] sm:rounded-[32px]">
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-orange/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-1/3 size-44 rounded-full bg-mint/10" />

        <div className="relative grid items-center gap-4 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_.9fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-green shadow-card">
              <Leaf size={12} aria-hidden /> Nutrition & metabolism
            </span>
            <h2 className="mt-3 text-[1.6rem] font-bold leading-tight tracking-[-0.02em] text-forest sm:text-[2rem]">{slide.title}</h2>
            <p className="mt-2 max-w-md text-[13.5px] leading-6 text-ink/70">{slide.description}</p>
            <button type="button" onClick={() => openBooking(null)} className="btn btn-mint mt-5">
              Book Now
            </button>
          </div>

          <DnaArtwork />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {SLIDES.map((item, dotIndex) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setIndex(dotIndex)}
            aria-label={`Show promotion ${dotIndex + 1}`}
            aria-current={dotIndex === index ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-forest' : 'w-1.5 bg-line hover:bg-muted/50'}`}
          />
        ))}
      </div>
    </section>
  )
}

function DnaArtwork() {
  return (
    <div className="relative mx-auto h-[180px] w-full max-w-[380px] sm:h-[210px]" aria-hidden>
      <svg viewBox="0 0 380 210" className="size-full" role="presentation" focusable="false">
        {/* Double helix */}
        <g strokeLinecap="round" strokeWidth="6" fill="none">
          <path d="M150 18c40 26 40 48 0 74s-40 48 0 74" stroke="#00B98B" opacity=".85" />
          <path d="M190 18c-40 26-40 48 0 74s40 48 0 74" stroke="#317B6C" opacity=".85" />
        </g>
        {[34, 56, 78, 100, 122, 144, 166].map((y, position) => (
          <line key={y} x1="158" y1={y} x2="182" y2={y} stroke="#FF9417" strokeWidth="3" opacity={position % 2 === 0 ? 0.9 : 0.45} strokeLinecap="round" />
        ))}
        <circle cx="250" cy="60" r="26" fill="#FF9417" opacity=".14" />
        <circle cx="300" cy="140" r="34" fill="#00B98B" opacity=".12" />
        <circle cx="262" cy="150" r="18" fill="#317B6C" opacity=".12" />
      </svg>

      <span className="absolute right-[18%] top-[8%] grid size-11 place-items-center rounded-full bg-white text-orange shadow-float"><Apple size={20} /></span>
      <span className="absolute right-[2%] top-[42%] grid size-10 place-items-center rounded-full bg-white text-mint-700 shadow-float"><Leaf size={18} /></span>
      <span className="absolute bottom-[6%] right-[24%] grid size-12 place-items-center rounded-full bg-white text-forest shadow-float"><Dumbbell size={20} /></span>
      <span className="absolute bottom-[16%] right-[4%] grid size-9 place-items-center rounded-full bg-forest text-white shadow-float"><Dna size={16} /></span>
    </div>
  )
}
