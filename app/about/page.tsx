import type { Metadata } from 'next'
import Link from 'next/link'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: 'About Us', description: 'About SV Diagnostics — a diagnostic laboratory serving Hyderabad.' }

export default async function AboutPage() {
  const { settings, locations } = await siteShell()
  return (
    <StorefrontShell settings={settings}>
      <PageHeader title="About SV Diagnostics" description={`${settings.tagline} · ${settings.city}, ${settings.state}`} breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'About' }]} />
      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-6">
            <h2 className="text-[18px] font-bold">Our laboratory</h2>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-7 text-muted">{settings.aboutText}</p>
          </section>
          <section className="card p-6">
            <h2 className="text-[18px] font-bold">How we work</h2>
            <div className="mt-3 space-y-3 text-[14px] leading-7 text-muted">
              <p>Our catalogue is maintained by our own team. Prices, preparation instructions and report turnaround are published only after they are entered and reviewed in our admin panel — the website has no hard-coded test data.</p>
              <p>Bookings are recorded against real slot capacity. When a slot is full, it cannot be booked, even if two people try at the same moment.</p>
              <p>Reports and patient details are released only to the person named on the booking, using their booking reference and registered phone number. We do not publish patient testimonials or claims we have not verified.</p>
            </div>
          </section>
          <section className="card p-6">
            <h2 className="text-[18px] font-bold">What we can help with</h2>
            <ul className="mt-2 grid gap-1.5 text-[13.5px] text-muted sm:grid-cols-2">
              <li>• Pathology and routine blood investigations</li>
              <li>• Preventive health packages</li>
              <li>• Home sample collection in covered areas</li>
              <li>• Booking and report tracking online</li>
            </ul>
          </section>
        </div>
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[14px] font-bold">Visit or call</h2>
            {locations.length ? (
              <ul className="mt-2 space-y-2 text-[13px] text-muted">
                {locations.map((location) => (
                  <li key={location.id}><b className="text-ink">{location.name}</b><br />{location.addressLine1}{location.area ? `, ${location.area}` : ''}</li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[13px] text-muted">Location details will be published shortly.</p>}
            {settings.supportPhone && <a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="link mt-3 block text-[13px]">{settings.supportPhone}</a>}
            {settings.supportEmail && <a href={`mailto:${settings.supportEmail}`} className="link block text-[13px]">{settings.supportEmail}</a>}
          </div>
          <div className="card p-5">
            <h2 className="text-[14px] font-bold">Book online</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-muted">Browse the catalogue and choose a collection slot.</p>
            <Link href="/tests" className="btn btn-primary btn-sm mt-3 w-full">Book a test</Link>
          </div>
        </aside>
      </div>
    </StorefrontShell>
  )
}
