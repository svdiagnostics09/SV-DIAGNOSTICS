import Image from 'next/image'
import { Handshake } from 'lucide-react'
import { PARTNERS, type Partner } from '@/lib/storefront/content'
import { Reveal } from '@/components/site/reveal'

/**
 * Partners / associated-labs strip.
 *
 * Two identical tracks are rendered side by side inside an overflow-hidden
 * window, and the CSS animation translates the pair by -50%. That gives a
 * perfectly seamless horizontal loop. Hovering (or focusing a card) pauses it.
 *
 * To change the partners edit `PARTNERS` in lib/storefront/content.ts — add the
 * image to `public/partners/` and point `logo` at it.
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

function PartnerCard({ partner }: { partner: Partner }) {
  const content = (
    <>
      <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-line bg-mint-50 text-[15px] font-extrabold tracking-tight text-forest transition group-hover:border-transparent group-hover:bg-forest group-hover:text-white">
        {partner.logo ? (
          <Image src={partner.logo} alt={`${partner.name} logo`} fill sizes="56px" className="object-contain p-1.5" />
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

export function PartnersMarquee({ partners = PARTNERS }: { partners?: Partner[] }) {
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
            <span className="text-reveal inline-block" style={{ '--reveal-delay': 1 } as React.CSSProperties}>
              <span>Trusted</span>{' '}
              <span className="text-shimmer">by hospitals</span>{' '}
              <span>and labs</span>
            </span>
          </h2>
          <p className="mt-3 text-[13.5px] leading-6 text-white/70">
            We collect and process samples with accredited hospital, imaging and insurance partners across our service cities.
          </p>
        </Reveal>
      </div>

      <div className="partners-marquee relative mt-9">
        <div className="partners-track gap-4" style={{ '--marquee-duration': `${Math.max(24, partners.length * 4.5)}s` } as React.CSSProperties}>
          {track.map((partner, index) => (
            <PartnerCard key={`${partner.id}-${index}`} partner={partner} />
          ))}
        </div>
      </div>

      <p className="container-x relative mt-6 text-center text-[11px] text-white/45">
        Partner names are placeholders — replace them with your own logo images in <code className="rounded bg-white/10 px-1 py-0.5">public/partners/</code>.
      </p>
    </section>
  )
}
