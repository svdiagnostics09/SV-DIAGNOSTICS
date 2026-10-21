import Link from 'next/link'
import { BookOpen, Clock3, MapPin, MessageCircleQuestion, Search } from 'lucide-react'
import { SEO_BLOCKS } from '@/lib/storefront/content'
import { FaqAccordion } from '@/components/storefront/faq-accordion'

const ASIDE_LINKS = [
  { icon: Search, label: 'Browse all lab tests', href: '/tests' },
  { icon: MapPin, label: 'Check home collection areas', href: '/service-areas' },
  { icon: Clock3, label: 'Track an existing booking', href: '/track' },
  { icon: BookOpen, label: 'Read the full price list', href: '/price-list' },
]

/** Long-form informational content plus the FAQ. */
export function SeoContent({ cityName }: { cityName: string }) {
  return (
    <section className="bg-section section-y" aria-labelledby="seo-heading">
      <div className="container-x grid gap-8 lg:grid-cols-[1.6fr_.9fr] lg:gap-10">
        <div>
          <h2 id="seo-heading" className="section-heading">
            Diagnostic tests and health checkups in {cityName}
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-7 text-muted">
            Everything you need to choose a test, book a home collection and understand your report — written plainly, without
            medical jargon.
          </p>

          <div className="mt-6 space-y-5">
            {SEO_BLOCKS.map((block) => (
              <article key={block.id} className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6">
                <h3 className="text-[15.5px] font-bold leading-snug text-forest sm:text-[17px]">{block.heading}</h3>
                <div className="mt-2 space-y-2.5">
                  {block.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)} className="text-[13px] leading-7 text-muted">{paragraph}</p>
                  ))}
                </div>
                {block.list && (
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {block.list.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12.5px] leading-5 text-ink/80">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-mint" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-card border border-line bg-white p-4 shadow-card">
            <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-forest">
              <MessageCircleQuestion size={15} aria-hidden /> Quick links
            </h3>
            <ul className="mt-2.5 space-y-0.5">
              {ASIDE_LINKS.map(({ icon: Icon, label, href }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] font-medium text-ink transition hover:bg-section hover:text-green">
                    <Icon size={14} className="text-green" aria-hidden /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <h3 className="text-[15.5px] font-bold text-forest">Frequently asked questions</h3>
            <p className="mt-1 text-[12.5px] text-muted">Answers to what patients ask most before booking.</p>
            <div className="mt-3">
              <FaqAccordion items={undefined} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
