'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight, Handshake, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicPartner } from '@/lib/partners'
import { Reveal } from '@/components/site/reveal'

/**
 * Partners / associated-labs strip — a horizontally scrolling marquee.
 *
 * Two identical tracks are rendered side by side and the CSS animation
 * translates the pair by -50%, which loops seamlessly. Motion pauses on hover,
 * on keyboard focus, and whenever the visitor presses the pause button (that
 * choice is remembered for the session). The arrows step through manually, and
 * reduced-motion visitors get a still row instead.
 *
 * Partners (name + uploaded image) are managed in Admin → Partners and loaded
 * from the database by the homepage.
 */

function initials(name: string) {
  return name
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function PartnerCard({ partner }: { partner: PublicPartner }) {
  const content = (
    <>
      <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-line bg-mint-50 text-[15px] font-extrabold tracking-tight text-forest transition group-hover:border-transparent group-hover:bg-forest group-hover:text-white">
        {partner.logoUrl ? (
          <Image src={partner.logoUrl} alt={`${partner.name} logo`} fill sizes="56px" className="object-contain p-1.5" />
        ) : (
          initials(partner.name)
        )}
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[13.5px] font-bold text-ink">{partner.name}</b>
        {partner.role && <span className="block truncate text-[11.5px] text-muted">{partner.role}</span>}
      </span>
    </>
  )

  const shared = 'group flex w-[236px] shrink-0 items-center gap-3 rounded-card border-line bg-white px-4 py-3 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-mint hover:shadow-lift'

  return partner.href ? (
    <a href={partner.href} className={`${shared} focus-visible:outline-2`} aria-label={`${partner.name}${partner.role ? ` — ${partner.role}` : ''}`}>
      {content}
    </a>
  ) : (
    <div className={shared} tabIndex={0}>
      {content}
    </div>
  )
}

export function PartnersMarquee({ partners }: { partners: PublicPartner[] }) {
  const [pausedByUser, setPausedByUser] = useState(false)
  const marqueeRef = useRef<HTMLDivElement>(null)

  // Remember the visitor's pause choice for the session.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('sv-partners-paused') === '1') setPausedByUser(true)
    } catch { /* private mode — ignore */ }
  }, [])

  const togglePaused = useCallback(() => {
    setPausedByUser((value) => {
      const next = !value
      try { window.sessionStorage.setItem('sv-partners-paused', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  /** Nudge the row roughly one card left or right. */
  const nudge = useCallback((direction: 1 | -1) => {
    const node = marqueeRef.current
    if (!node) return
    node.scrollBy({ left: direction * 260, behavior: 'smooth' })
  }, [])

  if (partners.length === 0) return null
  // Duplicate so the -50% translation lands exactly on the start of the copy.
  const track = [...partners, ...partners]

  return (
    <section id="partners" className="relative overflow-hidden bg-forest py-14 sm:py-16 lg:py-20" aria-labelledby="partners-heading">
      {/* Soft navy light + grid, keeps the band from reading as a flat block */}
      <div aria-hidden className="soft-grid pointer-events-none absolute inset-0 opacity-[0.13]" />
      <div aria-hidden className="pointer-events-none absolute -left-24 top-1/4 size-72 rounded-full bg-mint/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-green/30 blur-3xl" />

      <div className="container-x relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border-white/25 bg-white/10 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/85">
            <Handshake size={13} aria-hidden /> Our partners
          </span>
          <h2 id="partners-heading" className="mt-4 text-[1.85rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-white sm:text-[2.3rem]">
            <span className="text-reveal inline-block">
              <span>Trusted</span>{' '}
              <span className="text-shimmer">by hospitals</span>{' '}
              <span>and labs</span>
            </span>
          </h2>
          <p className="mt-3 text-[13.5px] leading-6 text-white/70">
            We collect and process samples with accredited hospital, imaging and insurance partners across our service cities.
          </p>
        </Reveal>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" onClick={() => nudge(-1)} className="grid size-9 place-items-center rounded-full border-white/25 text-white/80 transition hover:border-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-white" aria-label="Previous partners">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={togglePaused}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border-white/25 px-3 text-[11.5px] font-semibold text-white/85 transition hover:border-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            aria-pressed={pausedByUser}
          >
            {pausedByUser ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
            {pausedByUser ? 'Play' : 'Pause'}
          </button>
          <button type="button" onClick={() => nudge(1)} className="grid size-9 place-items-center rounded-full border-white/25 text-white/80 transition hover:border-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-white" aria-label="Next partners">
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={marqueeRef}
        className="partners-marquee no-scrollbar relative mt-7"
        data-paused={pausedByUser ? 'true' : 'false'}
        role="region"
        aria-label="Partner logos, scrolling horizontally"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') { event.preventDefault(); nudge(1) }
          if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-1) }
        }}
      >
        <div className="partners-track gap-4" style={{ '--marquee-duration': `${Math.max(24, partners.length * 4.5)}s` } as React.CSSProperties}>
          {track.map((partner, index) => (
            <PartnerCard key={`${partner.id}-${index}`} partner={partner} />
          ))}
        </div>
      </div>
    </section>
  )
}
