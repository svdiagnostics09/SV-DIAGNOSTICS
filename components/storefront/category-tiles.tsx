'use client'

import Link from 'next/link'
import { Activity, ArrowUpRight, HeartHandshake, ShieldCheck, Venus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FEATURED_CATEGORIES, type StoreCategory, type TileTone } from '@/lib/storefront/content'

const ICONS: Record<string, LucideIcon> = {
  'full-body': Activity,
  'sexual-health': ShieldCheck,
  'womens-health': Venus,
  allergy: HeartHandshake,
}

const TONE_CLASS: Record<TileTone, string> = {
  orange: 'bg-tile-orange',
  teal: 'bg-tile-teal',
  forest: 'bg-tile-forest',
}

const hrefFor = (category: StoreCategory) => {
  if (category.id === 'full-body') return '/packages'
  if (category.query) return `/tests?q=${encodeURIComponent(category.query)}`
  return category.slug ? `/tests?category=${category.slug}` : '/tests'
}

/** Compact 2×2 grid of gradient category tiles. */
export function CategoryTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {FEATURED_CATEGORIES.map((category) => {
        const Icon = ICONS[category.id] ?? Activity
        return (
          <Link
            key={category.id}
            href={hrefFor(category)}
            className={`group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-tile p-4 text-white shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-lift ${TONE_CLASS[category.tone]}`}
          >
            <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute -bottom-10 -left-6 size-20 rounded-full bg-white/10" />
            <Icon size={22} className="relative text-white" aria-hidden />
            <span className="relative flex items-end justify-between gap-2">
              <b className="text-[14px] font-bold leading-tight">{category.label}</b>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/25 transition group-hover:bg-white group-hover:text-forest">
                <ArrowUpRight size={14} aria-hidden />
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
