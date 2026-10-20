import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock3, Home, MapPin, Phone, IndianRupee } from 'lucide-react'
import { formatINR } from '@/lib/db'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { PageHeader, EmptyState } from '@/components/ui'

export const metadata: Metadata = { title: 'Service Areas', description: 'Home sample collection service areas served by SV Diagnostics in Hyderabad.' }
export const dynamic = 'force-dynamic'

export default async function ServiceAreasPage() {
  const [{ settings, areas, locations }] = await Promise.all([siteShell()])
  const active = areas.filter((area) => area.homeCollection)

  return (
    <SiteShell settings={settings}>
      <PageHeader
        title="Service Areas"
        description={`Home sample collection is available only in the areas the laboratory has configured as active in ${settings.city}. Enter your pincode at checkout and we will confirm eligibility before you pay.`}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Service areas' }]}
      />
      <div className="container-x py-8">
        {active.length === 0 ? (
          <div className="card"><EmptyState icon={MapPin} title="No home collection areas configured" description="Home collection coverage has not been published yet. Laboratory visits are still available — see the locations page." action={<Link href="/locations" className="btn btn-primary btn-sm">View locations</Link>} /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((area) => (
              <article key={area.id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-700"><Home size={19} aria-hidden /></span>
                  <span className="badge badge-green">Home collection</span>
                </div>
                <h2 className="mt-3 text-[15.5px] font-bold">{area.name}</h2>
                <p className="text-[12.5px] text-muted">{area.city}</p>
                <dl className="mt-3 space-y-1.5 text-[12.5px] text-muted">
                  {area.operatingHours && <div className="flex items-center gap-1.5"><Clock3 size={13} aria-hidden /><dt className="sr-only">Hours</dt><dd>{area.operatingHours}</dd></div>}
                  <div className="flex items-center gap-1.5"><IndianRupee size={13} aria-hidden /><dt className="sr-only">Collection fee</dt><dd>{area.collectionFeePaise > 0 ? `${formatINR(area.collectionFeePaise)} home collection fee` : 'No separate collection fee'}</dd></div>
                  <div className="flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden /><dt className="sr-only">Pincodes</dt><dd>Pincodes: {area.pincodes.length ? area.pincodes.join(', ') : 'Not listed'}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}

        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="card p-6">
            <h2 className="text-[16px] font-bold">Not in a listed area?</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">You can still book a laboratory visit at one of our locations. Home collection outside the listed areas cannot be booked online.</p>
            <Link href="/locations" className="btn btn-outline btn-sm mt-3">See laboratory locations</Link>
          </div>
          <div className="card p-6">
            <h2 className="text-[16px] font-bold">Laboratory locations</h2>
            <ul className="mt-2 space-y-2 text-[13px] text-muted">
              {locations.length === 0 ? <li>No locations published yet.</li> : locations.map((location) => (
                <li key={location.id} className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-teal-700" aria-hidden /><span><b className="text-ink">{location.name}</b>{location.area ? ` — ${location.area}` : ''}{location.phone ? <> · <a className="link" href={`tel:${location.phone.replace(/\s/g, '')}`}><Phone size={11} className="inline" aria-hidden /> {location.phone}</a></> : null}</span></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
