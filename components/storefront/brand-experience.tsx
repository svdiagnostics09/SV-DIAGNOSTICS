'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { EXPERIENCE_FEATURES } from '@/lib/storefront/content'

/**
 * Dark-green brand experience band: alternating image / copy rows with an
 * expandable "Read more". Animation is limited to fades and hover lifts.
 */
export function BrandExperience({ brandName }: { brandName: string }) {
  return (
    <section className="relative overflow-hidden bg-band-forest section-y text-white" aria-labelledby="experience-heading">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 size-[420px] rounded-full border border-white/[0.06]" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 size-[360px] rounded-full bg-white/[0.03]" />
      <div aria-hidden className="pointer-events-none absolute right-[18%] top-1/3 size-40 rounded-full bg-mint/[0.07]" />

      <div className="container-x relative">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow text-mint">How we work</span>
          <h2 id="experience-heading" className="mt-1.5 text-[1.6rem] font-bold leading-tight text-white sm:text-[2.1rem]">
            The {brandName} Experience
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-6 text-white/65">
            Five things that decide whether a diagnostic result is worth acting on — from the moment the tube is filled to the
            moment you read the report.
          </p>
        </div>

        <div className="mt-9 space-y-5 sm:space-y-7">
          {EXPERIENCE_FEATURES.map((feature, index) => (
            <FeatureRow key={feature.id} feature={feature} reversed={index % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureRow({ feature, reversed }: { feature: (typeof EXPERIENCE_FEATURES)[number]; reversed: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const panelId = `feature-more-${feature.id}`

  return (
    <article
      className={`flex flex-col gap-4 rounded-card border border-white/10 bg-white/[0.05] p-3 transition duration-300 hover:bg-white/[0.08] sm:flex-row sm:items-center sm:gap-6 sm:p-4 lg:gap-8 lg:p-5 ${reversed ? 'sm:flex-row-reverse' : ''}`}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-tile bg-white/10 sm:aspect-square sm:w-[190px] lg:w-[240px]">
        <Image
          src={feature.image.src}
          alt={feature.image.alt}
          fill
              sizes="(max-width: 640px) 92vw, 240px"
              className="object-cover transition duration-500 hover:scale-[1.03]"
            />
          </div>
          <div className="min-w-0 flex-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-mint">{feature.eyebrow}</span>
        <h3 className="mt-1.5 text-[17px] font-bold leading-snug text-white sm:text-[20px]">{feature.title}</h3>
        <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/70">{feature.body}</p>

        {feature.more && (
          <>
            <div id={panelId} hidden={!expanded} className="mt-2 max-w-xl text-[13px] leading-6 text-white/60">
              {feature.more}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-mint transition hover:text-white"
            >
              {expanded ? 'Read less' : 'Read more'}
              <ChevronDown size={14} className={`transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </>
        )}
      </div>
    </article>
  )
}
