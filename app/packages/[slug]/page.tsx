import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, FlaskConical, Home, Timer } from 'lucide-react'
import { getPackageBySlug } from '@/lib/catalogue'
import { formatINR } from '@/lib/db'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { AddToBooking } from '@/components/site/add-to-booking'
import { Breadcrumbs, Badge } from '@/components/ui'
import { sampleLabel, turnaroundLabel } from '@/lib/labels'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const pack = await getPackageBySlug(slug)
  return pack ? { title: pack.name, description: pack.description } : { title: 'Package not found' }
}

export default async function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [pack, { settings }] = await Promise.all([getPackageBySlug(slug), siteShell()])
  if (!pack || pack.status !== 'published') notFound()
  const off = pack.originalPricePaise && pack.originalPricePaise > pack.pricePaise ? Math.round(((pack.originalPricePaise - pack.pricePaise) / pack.originalPricePaise) * 100) : 0

  return (
    <SiteShell settings={settings}>
      <div className="border-b border-line bg-white">
        <div className="container-x py-6">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Health packages', href: '/packages' }, { label: pack.name }]} />
        </div>
      </div>
      <div className="container-x py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-5">
            <section className="card p-6">
              <div className="flex flex-wrap gap-2">
                {pack.isPopular && <Badge tone="teal">Popular</Badge>}
                {pack.homeCollection && <Badge tone="green">Home collection available</Badge>}
                <Badge tone="gray">{pack.testCount} test{pack.testCount === 1 ? '' : 's'}</Badge>
              </div>
              <h1 className="mt-3 text-[1.7rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2rem]">{pack.name}</h1>
              <p className="mt-2 whitespace-pre-line text-[14px] leading-7 text-muted">{pack.description || 'Preventive health check-up package.'}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><FlaskConical size={12} aria-hidden /> Sample</dt>
                  <dd className="text-[13px] font-medium">{pack.sampleType || 'As per included tests'}</dd>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Timer size={12} aria-hidden /> Report</dt>
                  <dd className="text-[13px] font-medium">{turnaroundLabel(pack.turnaroundHours)}</dd>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Home size={12} aria-hidden /> Collection</dt>
                  <dd className="text-[13px] font-medium">{pack.homeCollection ? 'Home or laboratory' : 'Laboratory only'}</dd>
                </div>
              </dl>
            </section>

            <section className="card p-6">
              <h2 className="text-[16px] font-bold">Included tests</h2>
              {pack.tests.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted">Included tests have not been configured for this package yet. Please contact the laboratory.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {pack.tests.map((test) => (
                    <li key={test.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/tests/${test.slug}`} className="text-[13.5px] font-semibold text-navy hover:text-teal-700">{test.name}</Link>
                        <p className="text-[11.5px] text-muted">{sampleLabel(test.sampleType)} · {turnaroundLabel(test.turnaroundHours)}</p>
                      </div>
                      <span className="shrink-0 text-[12.5px] tabular-nums text-muted">{formatINR(test.listPricePaise)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {pack.tests.length > 0 && (
                <p className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px]">
                  <span className="text-muted">Individual test total</span>
                  <b className="tabular-nums">{formatINR(pack.testsSumPaise)}</b>
                </p>
              )}
            </section>

            <section className="card p-6">
              <h2 className="text-[16px] font-bold">Preparation</h2>
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-6 text-muted">{pack.preparation || 'Follow the instructions shared at booking. If fasting is required for any included test, it is listed on that test page.'}</p>
            </section>

            <section className="card p-6">
              <h2 className="text-[16px] font-bold">Availability</h2>
              <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-teal-700" aria-hidden /> Bookable at {settings.brandName}, {settings.city}</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-teal-700" aria-hidden /> {pack.homeCollection ? 'Home sample collection available in covered service areas' : 'Available at the laboratory only'}</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-teal-700" aria-hidden /> Pay online, or pay at collection where enabled</li>
              </ul>
            </section>
          </div>

          <aside className="card p-6 lg:sticky lg:top-28">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Package price</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <b className="text-[2rem] font-bold text-navy tabular-nums">{formatINR(pack.pricePaise)}</b>
              {pack.originalPricePaise && pack.originalPricePaise > pack.pricePaise && <del className="text-[14px] text-muted tabular-nums">{formatINR(pack.originalPricePaise)}</del>}
            </div>
            {off > 0 && <p className="mt-1 text-[12px] font-semibold text-teal-700">{off}% off the original package price</p>}
            <AddToBooking
              className="mt-5"
              entry={{ kind: 'package', id: pack.id, name: pack.name, pricePaise: pack.pricePaise, homeCollection: pack.homeCollection }}
            />
            <p className="mt-4 border-t border-line pt-4 text-[11.5px] leading-5 text-muted">Package contents and price are validated on our server when you confirm the booking.</p>
          </aside>
        </div>
      </div>
    </SiteShell>
  )
}
