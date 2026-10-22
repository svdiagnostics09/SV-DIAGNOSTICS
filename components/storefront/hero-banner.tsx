'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Home as HomeIcon, ShieldCheck, Sparkles, Timer } from 'lucide-react'
import { IMAGES } from '@/lib/storefront/content'
import { formatINR } from '@/lib/format'
import { useCity } from '@/components/storefront/city-provider'

/** Closing price of the hero offer, in paise. */
const STARTING_PAISE = 159900

export function HeroBanner({ startingPricePaise = STARTING_PAISE }: { startingPricePaise?: number }) {
  const { city } = useCity()

  return (
    <section className="container-x pt-5 sm:pt-7" aria-labelledby="hero-heading">
      <div className="relative overflow-hidden rounded-[24px] bg-hero-peach sm:rounded-[32px]">
        {/* Decorative circles behind the product shot */}
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-orange/15 sm:size-96" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 size-52 rounded-full bg-orange/10 sm:size-64" />
        <div aria-hidden className="pointer-events-none absolute right-6 top-8 hidden size-24 rounded-full border border-orange/25 lg:block" />

        <div className="relative grid items-center gap-6 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-4 lg:px-14 lg:py-12">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11.5px] font-semibold text-orange-600 shadow-card">
              <Sparkles size={12} aria-hidden /> Trusted diagnostic care in {city.name}
            </span>
            <h1 id="hero-heading" className="mt-3 text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] text-forest sm:text-[2.85rem] lg:text-[3.1rem]">
              Full Body Checkups
            </h1>
            <p className="mt-3 max-w-md text-[14.5px] leading-6 text-ink/75 sm:text-[15.5px]">
              Discover how your everyday habits impact your health.
            </p>

            <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-[12.5px] font-medium text-ink/60">Starting at</span>
              <span className="text-[1.7rem] font-bold leading-none tracking-tight text-forest tabular-nums">{formatINR(startingPricePaise)}</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/book" className="btn btn-primary btn-lg">
                Book Now <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/packages" className="text-[13px] font-semibold text-forest underline-offset-4 hover:underline">
                View all checkups
              </Link>
            </div>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-medium text-ink/70">
              <li className="flex items-center gap-1.5"><HomeIcon size={14} className="text-green" aria-hidden /> Home collection</li>
              <li className="flex items-center gap-1.5"><Timer size={14} className="text-green" aria-hidden /> Reports in 24–48 hrs</li>
              <li className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-green" aria-hidden /> Secure digital reports</li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[460px]">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[22px] shadow-lift sm:rounded-[28px]">
              <Image
                src={IMAGES.bloodTubes.src}
                alt={IMAGES.bloodTubes.alt}
                fill
                priority
                sizes="(max-width: 1024px) 92vw, 460px"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-3 left-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-float sm:left-5">
              <span className="grid size-8 place-items-center rounded-full bg-mint-50 text-mint-700"><Timer size={15} aria-hidden /></span>
              <span className="leading-tight">
                <b className="block text-[12px] font-bold text-ink">Fastest report</b>
                <span className="text-[10.5px] text-muted">Same-day for select tests</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
