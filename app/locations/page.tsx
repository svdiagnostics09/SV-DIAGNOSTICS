import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock3, ExternalLink, Mail, MapPin, Phone } from 'lucide-react'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { PageHeader, EmptyState, Badge } from '@/components/ui'

export const metadata: Metadata = { title: 'Locations', description: 'SV Diagnostics laboratory branches in Hyderabad with addresses, phone numbers and opening hours.' }
export const revalidate = 60

export default async function LocationsPage() {
  const { settings, locations } = await siteShell()

  return (
    <SiteShell settings={settings}>
      <PageHeader
        title="Laboratory Locations"
        description="Visit us for sample collection or walk-in guidance. Online bookings use these locations' configured slots."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Locations' }]}
      />
      <div className="container-x py-8">
        {locations.length === 0 ? (
          <div className="card"><EmptyState icon={MapPin} title="No locations published" description="Laboratory locations will appear here once the administrator adds and activates them." action={<Link href="/contact" className="btn btn-primary btn-sm">Contact us</Link>} /></div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {locations.map((location) => {
              const directions = location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location.addressLine1, location.addressLine2, location.area, location.city, location.pincode].filter(Boolean).join(', '))}`
              return (
                <article key={location.id} className="card flex flex-col p-6">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-10 place-items-center rounded-lg bg-[#e8eef8] text-navy"><MapPin size={19} aria-hidden /></span>
                    <Badge tone="green">Accepting bookings</Badge>
                  </div>
                  <h2 className="mt-3 text-[17px] font-bold">{location.name}</h2>
                  <address className="mt-1 not-italic text-[13px] leading-6 text-muted">
                    {location.addressLine1}{location.addressLine2 ? <>, {location.addressLine2}</> : null}<br />
                    {[location.area, location.city, location.state, location.pincode].filter(Boolean).join(', ')}
                  </address>
                  <ul className="mt-3 space-y-2 text-[13px] text-muted">
                    {location.phone && <li><a href={`tel:${location.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-teal-700"><Phone size={14} aria-hidden /> {location.phone}</a></li>}
                    {location.email && <li><a href={`mailto:${location.email}`} className="flex items-center gap-2 hover:text-teal-700"><Mail size={14} aria-hidden /> {location.email}</a></li>}
                    {location.openingHours && <li className="flex items-start gap-2"><Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden /> {location.openingHours}</li>}
                  </ul>
                  {location.services.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {location.services.map((service) => <span key={service} className="badge badge-gray">{service}</span>)}
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Directions <ExternalLink size={13} aria-hidden /></a>
                    <Link href={`/tests?location=${location.id}`} className="btn btn-primary btn-sm">Book a test here</Link>
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
