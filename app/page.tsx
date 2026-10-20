import { headers } from 'next/headers'
import { Suspense } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FlaskConical,
  HeartPulse,
  Home,
  MapPin,
  Microscope,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  Truck,
  UserRound,
} from 'lucide-react'
import { listBanners, listFaqs } from '@/lib/content'
import { formatINR } from '@/lib/format'
import { siteShell, popularTests } from '@/lib/page-data'
import { listPackages } from '@/lib/catalogue'
import { SiteShell } from '@/components/site/site-shell'
import { TestCard } from '@/components/site/test-card'
import { HomeSearch } from '@/components/site/home-search'
import { AreaCheck } from '@/components/site/area-check'
import { SectionHeading, IconTile } from '@/components/ui'

export const revalidate = 60

const CATEGORY_ICONS: Record<string, typeof Home> = {
  pathology: Microscope,
  diabetes: HeartPulse,
  thyroid: Stethoscope,
  vitamins: HeartPulse,
}

export default async function HomePage() {
  const [{ settings, categories, locations, areas }, tests, packages, faqs, banners, requestHeaders] = await Promise.all([
    siteShell(),
    popularTests(6),
    listPackages({ popularOnly: true }),
    listFaqs(),
    listBanners({ placement: 'home' }),
    headers(),
  ])
  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const origin = `${host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'}://${host}`
  const searchData = JSON.stringify({ tests: tests.map((test) => ({ id: test.id, name: test.name, slug: test.slug, category: test.categoryName, pricePaise: test.listPricePaise })) }).replace(/</g, '\\u003c')
  const topPackages = packages.length ? packages.slice(0, 3) : (await listPackages()).slice(0, 3)
  const activeAreas = areas.filter((area) => area.homeCollection).slice(0, 12)
  const labLocations = locations.slice(0, 2)
  const banner = banners[0]
  const reportHours = tests.map((test) => test.turnaroundHours).filter((hours): hours is number => Boolean(hours))

  return (
    <SiteShell settings={settings}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MedicalBusiness',
          name: settings.brandName,
          description: settings.aboutText,
          address: { '@type': 'PostalAddress', addressLocality: settings.city, addressRegion: settings.state, streetAddress: settings.address },
          telephone: settings.supportPhone || undefined,
          url: origin,
        })
      }} />

      {/* Hero — navy headline with teal accent */}
      <section className="border-b border-line bg-white">
        <div className="container-x grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_.95fr] lg:py-14">
          <div>
            <span className="badge badge-teal"><Sparkles size={12} aria-hidden /> {settings.city} · Lab &amp; imaging</span>
            <h1 className="mt-4 text-[2.35rem] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[3rem]">
              Accurate tests.<br />
              <span className="text-teal-700">Caring hands.</span><br />
              Reports you can trust.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted">
              Book diagnostic tests and health packages online with home sample collection and secure digital reports — delivered fast, handed with care.
            </p>

            <div className="mt-6 max-w-xl">
              <Suspense fallback={<div className="skeleton h-14 w-full rounded-xl" />}>
                <HomeSearch initial={searchData} />
              </Suspense>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-muted">
                <li className="flex items-center gap-1.5"><Truck size={14} className="text-teal-700" aria-hidden /> Home sample collection</li>
                <li className="flex items-center gap-1.5"><FileCheck2 size={14} className="text-teal-700" aria-hidden /> Digital reports</li>
                <li className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-teal-700" aria-hidden /> Secure &amp; private</li>
              </ul>
            </div>
          </div>

          <div>
            <div className="card bg-page p-6 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <IconTile icon={Home} />
                <span className="badge badge-navy">Home collection</span>
              </div>
              <h2 className="mt-4 text-[18px] font-bold leading-snug">{banner ? banner.title : 'Sample collection from your home'}</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-muted">
                {banner ? banner.subtitle : `Choose a test, enter your pincode and pick a slot. Availability comes from our live schedule in ${settings.city}.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/tests" className="btn btn-primary">{banner?.ctaLabel || 'Book a test'} <ArrowRight size={15} aria-hidden /></Link>
                <Link href="/track" className="btn btn-outline">Track appointment</Link>
              </div>
              <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-white text-center">
                {[
                  [String(categories.reduce((sum, category) => sum + category.testCount, 0)), 'Tests'],
                  [reportHours.length ? `${Math.min(...reportHours)} h` : '—', 'Fastest report'],
                  [String(locations.length), 'Locations'],
                ].map(([value, label]) => (
                  <div key={label} className="px-2 py-3">
                    <dt className="text-[17px] font-bold text-navy tabular-nums">{value}</dt>
                    <dd className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-teal-50/60 px-4 py-3 text-[12.5px]">
              <span className="flex items-center gap-2"><Clock3 size={14} className="text-teal-700" aria-hidden /> Reports are released as soon as the laboratory marks them ready.</span>
              <Link href="/faq" className="hidden font-semibold text-teal-700 hover:underline sm:inline">FAQ</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-line bg-white">
        <div className="container-x grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          {([
            [Home, 'Home collection', 'Covered service areas'],
            [BadgeCheck, 'Quality processes', 'Documented procedures'],
            [FileCheck2, 'Digital reports', 'Secure, private access'],
            [UserRound, 'Trained collectors', 'Samples handled with care'],
          ] as [typeof Home, string, string][]).map(([Icon, title, sub]) => (
            <div key={title} className="flex items-center gap-2.5 px-4 py-3.5">
              <Icon size={18} className="shrink-0 text-teal-700" aria-hidden />
              <div>
                <b className="block text-[12.5px] font-semibold leading-tight text-navy">{title}</b>
                <span className="text-[11px] text-muted">{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Explore by category */}
      <section className="container-x py-10" aria-labelledby="categories-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="categories-heading" className="text-[1.45rem] font-bold tracking-[-0.02em]">Explore by category</h2>
            <p className="mt-1 text-[13px] text-muted">Find the right test for your health need.</p>
          </div>
          <Link href="/tests" className="shrink-0 text-[12.5px] font-semibold text-teal-700 hover:underline">View all tests →</Link>
        </div>
        {categories.length === 0 ? (
          <div className="card mt-4 border-dashed p-8 text-center text-[13px] text-muted">
            Categories will appear here once published by the laboratory.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <Link key={category.id} href={`/tests?category=${category.slug}`} className="card group flex items-center gap-3 p-3.5 transition hover:border-teal/50 hover:shadow-card">
                <IconTile icon={CATEGORY_ICONS[category.slug] ?? FlaskConical} size="sm" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-semibold text-navy">{category.name}</b>
                  <span className="text-[11.5px] text-muted">{category.testCount} test{category.testCount === 1 ? '' : 's'}</span>
                </div>
                <ArrowRight size={14} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Frequently booked tests */}
      <section className="border-t border-line bg-white py-10" aria-labelledby="popular-heading">
        <div className="container-x">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="popular-heading" className="text-[1.45rem] font-bold tracking-[-0.02em]">Frequently booked tests</h2>
              <p className="mt-1 text-[13px] text-muted">Book online, or over the phone if you prefer.</p>
            </div>
            <Link href="/tests" className="shrink-0 text-[12.5px] font-semibold text-teal-700 hover:underline">All tests →</Link>
          </div>
          {tests.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center p-10 text-center">
              <TestTube2 size={22} className="text-muted" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-navy">The catalogue is being prepared</p>
              <p className="mt-1 max-w-md text-[13px] leading-5 text-muted">Tests will appear here as soon as the administrator publishes them. Please call{settings.supportPhone ? ` ${settings.supportPhone}` : ' the laboratory'} for assistance.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tests.map((test) => <TestCard key={test.id} test={test} />)}
            </div>
          )}
        </div>
      </section>

      {/* Health packages */}
      {topPackages.length > 0 && (
        <section className="py-10">
          <div className="container-x">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[1.45rem] font-bold tracking-[-0.02em]">Health packages</h2>
                <p className="mt-1 text-[13px] text-muted">Comprehensive checkups curated by our team — at a better price than individual tests.</p>
              </div>
              <Link href="/packages" className="shrink-0 text-[12.5px] font-semibold text-teal-700 hover:underline">All packages →</Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topPackages.map((pack) => (
                <article key={pack.id} className="card flex flex-col p-4 transition hover:border-teal/50 hover:shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge badge-teal">Package</span>
                    {pack.isPopular && <span className="badge badge-navy">Popular</span>}
                  </div>
                  <h3 className="mt-2.5 text-[15px] font-bold leading-snug text-navy"><Link href={`/packages/${pack.slug}`} className="hover:text-teal-700">{pack.name}</Link></h3>
                  <p className="mt-1.5 text-[12.5px] text-muted">{pack.testCount} test{pack.testCount === 1 ? '' : 's'} included</p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                    <div>
                      <b className="text-[19px] font-bold text-navy tabular-nums">{formatINR(pack.pricePaise)}</b>
                      {pack.originalPricePaise && pack.originalPricePaise > pack.pricePaise && <del className="ml-2 text-[11.5px] text-muted tabular-nums">{formatINR(pack.originalPricePaise)}</del>}
                    </div>
                    <Link href={`/packages/${pack.slug}`} className="btn btn-outline btn-sm">View package</Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why choose — navy band */}
      <section className="bg-navy py-12 text-white" aria-labelledby="why-heading">
        <div className="container-x grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <h2 id="why-heading" className="text-[1.6rem] font-bold leading-tight text-white sm:text-[1.9rem]">Why choose {settings.brandName}</h2>
            <p className="mt-3 max-w-md text-[13.5px] leading-6 text-white/70">
              A patient-first approach backed by a carefully managed laboratory process — so every result is accurate and every visit is easy.
            </p>
            <Link href="/about" className="btn mt-5 border border-white/25 bg-transparent text-white hover:bg-white/10">About the laboratory</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: BadgeCheck, title: 'Clear test information', body: 'Each test page lists the sample, preparation and report time we publish.' },
              { icon: Home, title: 'Home collection', body: activeAreas.length ? `Available in ${activeAreas.length} configured service areas.` : 'Coverage is being configured.' },
              { icon: FileCheck2, title: 'Digital reports', body: 'Shared securely through your booking page, never posted publicly.' },
              { icon: ClipboardCheck, title: 'Easy booking', body: 'Book in minutes; slots reflect real capacity.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                <Icon size={18} className="text-[#7fe3d6]" aria-hidden />
                <b className="mt-2 block text-[13.5px] font-semibold text-white">{title}</b>
                <p className="mt-1 text-[12px] leading-5 text-white/65">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Area check + locations */}
      <section className="py-12">
        <div className="container-x grid gap-5 lg:grid-cols-[1fr_.9fr]">
          <div className="card border-teal/30 bg-teal-50/50 p-6">
            <div className="flex items-center gap-2"><MapPin size={18} className="text-teal-700" aria-hidden /><h2 className="text-[16px] font-bold">Check if we collect near you</h2></div>
            <p className="mt-1 text-[13px] leading-6 text-muted">Enter your pincode to see whether home sample collection is available in your area.</p>
            <AreaCheck areas={activeAreas.map((area) => ({ name: area.name, pincodes: area.pincodes, feePaise: area.collectionFeePaise }))} />
            <Link href="/service-areas" className="link mt-3 inline-block text-[12.5px]">See full service area list →</Link>
          </div>
          <div className="card p-6">
            <h2 className="text-[16px] font-bold">Visit a lab near you</h2>
            <p className="mt-1 text-[13px] text-muted">Walk in or pre-book your lab visit.</p>
            {labLocations.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-line p-4 text-[12.5px] text-muted">Locations will appear once published by the administrator.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {labLocations.map((location) => (
                  <li key={location.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-[13.5px] font-semibold text-navy">{location.name}</b>
                      <a className="shrink-0 text-[12px] font-semibold text-teal-700 hover:underline" href={location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location.addressLine1, location.area, location.city, location.pincode].join(', '))}`} target="_blank" rel="noopener noreferrer">Directions</a>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-5 text-muted">{location.addressLine1}{location.addressLine2 ? `, ${location.addressLine2}` : ''}{location.area ? `, ${location.area}` : ''}, {location.city} {location.pincode}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
                      {location.phone && <a href={`tel:${location.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 hover:text-teal-700"><Phone size={11} aria-hidden /> {location.phone}</a>}
                      {location.openingHours && <span className="flex items-center gap-1"><Clock3 size={11} aria-hidden /> {location.openingHours}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/locations" className="btn btn-outline btn-sm mt-3 w-full">All lab locations</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="border-t border-line bg-white py-12">
          <div className="container-x max-w-3xl">
            <SectionHeading eyebrow="Questions" title="Frequently asked questions" />
            <div className="mt-5 divide-y divide-line rounded-xl border border-line">
              {faqs.slice(0, 6).map((faq) => (
                <details key={faq.id} className="group px-4 py-3.5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-semibold text-navy">
                    {faq.question}
                    <ArrowRight size={15} className="shrink-0 rotate-90 text-muted transition group-open:rotate-[270deg]" aria-hidden />
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
            <Link href="/faq" className="mt-3 inline-block text-[13px] font-semibold text-teal-700 hover:underline">See all questions</Link>
          </div>
        </section>
      )}

      {/* CTA band */}
      <section className="pb-12 pt-4">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-2xl bg-navy p-8 text-center sm:p-10">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
            <h2 className="relative text-[1.5rem] font-bold text-white sm:text-[1.8rem]">Ready to book your test?</h2>
            <p className="relative mx-auto mt-2 max-w-xl text-[13.5px] leading-6 text-white/70">Choose from our published tests and packages. Home collection where we cover your area.</p>
            <div className="relative mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/tests" className="btn btn-primary">Book a test now <ArrowRight size={15} aria-hidden /></Link>
              <Link href="/contact" className="btn border border-white/25 bg-transparent text-white hover:bg-white/10">Talk to us</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
