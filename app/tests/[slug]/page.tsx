import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Clock3, FileText, FlaskConical, Home, MapPin, ShieldCheck, Timer } from 'lucide-react'
import { getTestBySlug, investigationsForTest, listTests } from '@/lib/catalogue'
import { formatINR } from '@/lib/db'
import { listLocations } from '@/lib/network'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { sampleLabel, turnaroundLabel } from '@/lib/labels'
import { AddToBooking } from '@/components/site/add-to-booking'
import { TestCard } from '@/components/site/test-card'
import { Breadcrumbs, Badge } from '@/components/ui'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const test = await getTestBySlug(slug)
  if (!test) return { title: 'Test not found' }
  return { title: test.name, description: test.shortDescription || `${test.name} at SV Diagnostics. ${formatINR(test.listPricePaise)}.` }
}

export default async function TestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [test, { settings }] = await Promise.all([getTestBySlug(slug), siteShell()])
  if (!test || test.status !== 'published') notFound()
  const [investigations, locations, related] = await Promise.all([
    investigationsForTest(test.id),
    listLocations(),
    listTests({ category: test.categorySlug, pageSize: 4 }),
  ])
  const discounted = test.listPricePaise < test.pricePaise
  const activeLocations = locations

  return (
    <StorefrontShell settings={settings}>
      <div className="border-b border-line bg-white">
        <div className="container-x py-6">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Diagnostic tests', href: '/tests' }, { label: test.name }]} />
        </div>
      </div>

      <div className="container-x py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-5">
            <section className="card p-6">
              <div className="flex flex-wrap items-center gap-2">
                {test.categoryName && <Badge tone="gray">{test.categoryName}</Badge>}
                {test.isPopular && <Badge tone="teal">Popular</Badge>}
                {test.homeCollection && <Badge tone="green">Home collection available</Badge>}
              </div>
              <h1 className="mt-3 text-[1.7rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2rem]">{test.name}</h1>
              <p className="mt-2 text-[14px] leading-7 text-muted">{test.shortDescription || test.description || 'Diagnostic investigation offered by SV Diagnostics.'}</p>

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: FlaskConical, label: 'Sample type', value: sampleLabel(test.sampleType) },
                  { icon: Timer, label: 'Report turnaround', value: turnaroundLabel(test.turnaroundHours) },
                  { icon: FileText, label: 'Report type', value: test.reportType || 'Digital report' },
                  { icon: Home, label: 'Home collection', value: test.homeCollection ? 'Available in covered areas' : 'Laboratory visit only' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5 rounded-lg border border-line p-3">
                    <Icon size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
                      <dd className="text-[13px] font-medium text-ink">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>

            {test.description && (
              <section className="card p-6">
                <h2 className="text-[16px] font-bold">About this test</h2>
                <p className="mt-2 whitespace-pre-line text-[13.5px] leading-7 text-muted">{test.description}</p>
              </section>
            )}

            <section className="card p-6">
              <h2 className="text-[16px] font-bold">Preparation</h2>
              {test.fastingRequired ? (
                <p className="mt-2 flex items-start gap-2 text-[13.5px] leading-6 text-ink">
                  <Clock3 size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />
                  Fasting required{test.fastingHours ? ` for ${test.fastingHours} hours` : ''}. Please follow the laboratory&apos;s guidance.
                </p>
              ) : (
                <p className="mt-2 text-[13.5px] leading-6 text-muted">No fasting requirement has been recorded for this test. Follow any advice given at booking.</p>
              )}
              {test.preparation && <p className="mt-2 whitespace-pre-line rounded-lg bg-page p-3 text-[13px] leading-6 text-ink">{test.preparation}</p>}
              <p className="mt-3 text-[12px] text-muted">Always inform our staff about medication, pregnancy or recent illness before collection.</p>
            </section>

            {test.sampleTypes.length > 0 && (
              <section className="card p-6">
                <h2 className="text-[16px] font-bold">Available sample types</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {test.sampleTypes.map((sample) => <li key={sample}><Badge tone="navy">{sample}</Badge></li>)}
                </ul>
              </section>
            )}

            {investigations.length > 0 && (
              <section className="card p-6">
                <h2 className="text-[16px] font-bold">Investigations covered</h2>
                <ul className="mt-2 grid gap-1.5 text-[13px] text-muted sm:grid-cols-2">
                  {investigations.map((item) => <li key={item.id} className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-teal" aria-hidden />{item.name}</li>)}
                </ul>
              </section>
            )}

            <section className="card p-6">
              <h2 className="text-[16px] font-bold">Available locations</h2>
              {activeLocations.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted">No laboratory locations have been published yet.</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {activeLocations.map((location) => (
                    <li key={location.id} className="flex items-start gap-2.5 rounded-lg border border-line p-3">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />
                      <div>
                        <b className="text-[13px] font-semibold text-navy">{location.name}</b>
                        <p className="text-[12.5px] leading-5 text-muted">{location.addressLine1}{location.area ? `, ${location.area}` : ''} {location.pincode}</p>
                        {location.openingHours && <p className="text-[12px] text-muted">{location.openingHours}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/locations" className="link mt-3 inline-block text-[12.5px]">Location details and directions →</Link>
            </section>
          </div>

          {/* Booking card */}
          <aside className="card p-6 lg:sticky lg:top-28">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Test price</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <b className="text-[2rem] font-bold text-navy tabular-nums">{formatINR(test.listPricePaise)}</b>
              {discounted && <del className="text-[14px] text-muted tabular-nums">{formatINR(test.pricePaise)}</del>}
            </div>
            {test.discountType !== 'none' && test.discountValue > 0 && (
              <p className="mt-1 text-[12px] font-semibold text-teal-700">
                {test.discountType === 'percent' ? `${test.discountValue}% discount applied` : `${formatINR(test.discountValue)} discount applied`}
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted"><ShieldCheck size={14} className="text-teal-700" aria-hidden /> Final amount is recalculated on the server at checkout.</p>

            <AddToBooking
              className="mt-5"
              entry={{ kind: 'test', id: test.id, name: test.name, pricePaise: test.listPricePaise, homeCollection: test.homeCollection }}
            />

            {settings.supportPhone && (
              <p className="mt-4 border-t border-line pt-4 text-[12.5px] text-muted">
                Questions about this test? <a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="link">{settings.supportPhone}</a>
              </p>
            )}
            <p className="mt-2 text-[11.5px] leading-5 text-muted">This page is information about a laboratory test and is not medical advice. Results should be discussed with a qualified doctor.</p>
          </aside>
        </div>

        {related.tests.filter((item) => item.id !== test.id).length > 0 && (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-[1.25rem] font-bold">More in {test.categoryName || 'the catalogue'}</h2>
              <Link href={`/tests?category=${test.categorySlug}`} className="text-[12.5px] font-semibold text-teal-700 hover:underline">View all <ArrowRight size={13} className="inline" aria-hidden /></Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.tests.filter((item) => item.id !== test.id).slice(0, 3).map((item) => <TestCard key={item.id} test={item} />)}
            </div>
          </section>
        )}
      </div>
    </StorefrontShell>
  )
}
