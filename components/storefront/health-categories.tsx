'use client'

import Link from 'next/link'
import { Bone, Brain, Droplets, FlaskConical, Heart, HeartPulse, Sparkles, ArrowRight, Wind } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ORGAN_CATEGORIES } from '@/lib/storefront/content'

const ICONS: Record<string, LucideIcon> = {
  heart: Heart,
  // lucide-react has no organ icons; these map to the closest available
  // concept. Replace with custom artwork if anatomical accuracy matters.
  liver: FlaskConical,
  kidney: Droplets,
  thyroid: HeartPulse,
  lungs: Wind,
  brain: Brain,
  bones: Bone,
  pancreas: Sparkles,
  vitamins: Sparkles,
}

/** Organ-focused quick links plus the dark-green "can't find it" CTA. */
export function HealthCategoriesSection() {
  return (
    <section className="bg-section section-y" aria-labelledby="organs-heading">
      <div className="container-x">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Browse by organ</span>
            <h2 id="organs-heading" className="section-heading mt-1.5">For Vital Body Organs</h2>
            <p className="mt-1.5 text-[13px] text-muted">Explore tests grouped by the organ system they assess.</p>
          </div>
          <Link href="/tests" className="btn btn-outline-green btn-sm shrink-0 self-start sm:self-auto">
            View All Checkups <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {ORGAN_CATEGORIES.map((category) => {
            const Icon = ICONS[category.id] ?? Heart
            const href = category.query ? `/tests?q=${encodeURIComponent(category.query)}` : `/tests?category=${category.slug}`
            return (
              <li key={category.id}>
                <Link
                  href={href}
                  className="group flex h-full flex-col items-center gap-2.5 rounded-tile border border-line bg-white px-3 py-4 text-center shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-mint hover:shadow-lift"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-mint-50 text-mint-700 transition group-hover:bg-mint group-hover:text-white">
                    <Icon size={19} aria-hidden />
                  </span>
                  <b className="text-[12.5px] font-semibold leading-tight text-ink">{category.label}</b>
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="relative mt-6 overflow-hidden rounded-card bg-band-forest px-6 py-7 text-white sm:px-9 sm:py-8">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full border border-white/10" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 size-40 rounded-full bg-white/[0.04]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[1.25rem] font-bold leading-tight text-white sm:text-[1.5rem]">Can’t find what you are looking for?</h3>
              <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-white/70">
                Browse the full catalogue, or tell our team what you need and we will suggest the right test.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/tests" className="btn btn-primary btn-sm">Browse all tests</Link>
              <Link href="/contact" className="btn btn-sm border border-white/25 bg-transparent text-white hover:bg-white/10">Contact support</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
