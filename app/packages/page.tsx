import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Home, Package, Timer } from 'lucide-react'
import { listPackages } from '@/lib/catalogue'
import { formatINR } from '@/lib/format'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { PageHeader, EmptyState } from '@/components/ui'

export const metadata: Metadata = { title: 'Health Packages', description: 'Health check-up packages at SV Diagnostics, Hyderabad, with included tests and package pricing.' }
export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
  const [{ settings }, packages] = await Promise.all([siteShell(), listPackages()])

  return (
    <SiteShell settings={settings}>
      <PageHeader
        title="Health Packages"
        description="Curated packages for preventive check-ups. Each package lists exactly which investigations are included; prices and contents are validated by the laboratory."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Health packages' }]}
      />
      <div className="container-x py-8">
        {packages.length === 0 ? (
          <div className="card"><EmptyState icon={Package} title="No health packages published yet" description="Our team is preparing the package catalogue. Please browse individual tests in the meantime." action={<Link href="/tests" className="btn btn-primary btn-sm">Browse tests</Link>} /></div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pack) => {
              const off = pack.originalPricePaise && pack.originalPricePaise > pack.pricePaise ? Math.round(((pack.originalPricePaise - pack.pricePaise) / pack.originalPricePaise) * 100) : 0
              return (
                <article key={pack.id} className="card flex flex-col p-5 transition hover:border-teal/50 hover:shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-700"><Package size={19} aria-hidden /></span>
                    <div className="flex gap-1.5">
                      {pack.isPopular && <span className="badge badge-teal">Popular</span>}
                      {off > 0 && <span className="badge badge-green">{off}% off</span>}
                    </div>
                  </div>
                  <h2 className="mt-3 text-[17px] font-bold leading-snug"><Link href={`/packages/${pack.slug}`} className="hover:text-teal-700">{pack.name}</Link></h2>
                  <p className="mt-1.5 line-clamp-3 min-h-[3.75rem] text-[13px] leading-5 text-muted">{pack.description || 'Preventive health check-up package.'}</p>
                  <ul className="mt-2 space-y-1.5 text-[12.5px] text-muted">
                    <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-teal-700" aria-hidden /> {pack.testCount || 'Multiple'} test{pack.testCount === 1 ? '' : 's'} included</li>
                    <li className="flex items-center gap-1.5"><Timer size={13} className="text-teal-700" aria-hidden /> {pack.turnaroundHours ? `${pack.turnaroundHours} hour turnaround` : 'Report time shared at booking'}</li>
                    {pack.homeCollection && <li className="flex items-center gap-1.5"><Home size={13} className="text-teal-700" aria-hidden /> Home collection available</li>}
                  </ul>
                  <div className="mt-auto pt-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <b className="text-[22px] font-bold text-navy tabular-nums">{formatINR(pack.pricePaise)}</b>
                      {pack.originalPricePaise && pack.originalPricePaise > pack.pricePaise && <del className="text-[13px] text-muted tabular-nums">{formatINR(pack.originalPricePaise)}</del>}
                      {pack.testsSumPaise > pack.pricePaise && <span className="text-[11.5px] text-muted">Individual tests: {formatINR(pack.testsSumPaise)}</span>}
                    </div>
                    <Link href={`/packages/${pack.slug}`} className="btn btn-primary btn-sm mt-3 w-full">View package <ArrowRight size={14} aria-hidden /></Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
