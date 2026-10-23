import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarCheck, ClipboardList, Home, MapPin, ShieldCheck, Stethoscope, Truck, UserCheck } from 'lucide-react'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { PageHeader, IconTile } from '@/components/ui'
import { formatINR } from '@/lib/db'

export const metadata: Metadata = { title: 'Home Sample Collection', description: 'Book home sample collection with SV Diagnostics in serviced areas of Hyderabad.' }
export const revalidate = 60

export default async function HomeCollectionPage() {
  const { settings, areas, locations } = await siteShell()
  const active = areas.filter((area) => area.homeCollection)

  return (
    <StorefrontShell settings={settings}>
      <PageHeader
        title="Home Sample Collection"
        description="A trained phlebotomist visits you at a slot you choose. Availability depends on your pincode and whether the selected test can be collected at home."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Home collection' }]}
      >
        <Link href="/tests" className="btn btn-primary">Book a test</Link>
      </PageHeader>

      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-5">
          <section className="card p-6">
            <h2 className="text-[17px] font-bold">How home collection works</h2>
            <ol className="mt-4 space-y-4">
              {[
                { icon: ClipboardList, title: 'Add tests or a package', body: 'Choose items marked “Home collection available”. Tests that require a laboratory visit will show that clearly.' },
                { icon: MapPin, title: 'Enter your address and pincode', body: 'We check your pincode against the laboratory’s active service areas before showing time slots.' },
                { icon: CalendarCheck, title: 'Pick a slot', body: 'Only slots with remaining capacity in your area are shown. Your slot is reserved when you confirm.' },
                { icon: UserCheck, title: 'Give your sample', body: 'Our collector visits at your slot. Bring any prescription the laboratory has asked for.' },
                { icon: ShieldCheck, title: 'Track and receive results', body: 'Track the booking with your reference and phone number. The status changes only as staff update it.' },
              ].map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="flex gap-3">
                  <span className="relative">
                    <IconTile icon={Icon} size="sm" />
                    <span className="absolute -left-1 -top-1 grid size-4 place-items-center rounded-full bg-navy text-[9px] font-bold text-white">{index + 1}</span>
                  </span>
                  <div>
                    <b className="text-[14px] font-semibold text-navy">{title}</b>
                    <p className="mt-0.5 text-[13px] leading-6 text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-6">
            <h2 className="text-[17px] font-bold">Before the visit</h2>
            <ul className="mt-3 grid gap-2 text-[13px] leading-6 text-muted sm:grid-cols-2">
              <li>• Keep a valid ID and your booking reference handy.</li>
              <li>• Follow any fasting instructions on the test page.</li>
              <li>• Ensure someone is available at the address during the slot.</li>
              <li>• Collection may be rescheduled if access is not possible.</li>
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="text-[17px] font-bold">Laboratory visits</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">Tests not eligible for home collection can be booked at any active laboratory location:</p>
            <ul className="mt-3 space-y-2">
              {locations.length === 0 ? <li className="text-[13px] text-muted">No locations published yet.</li> : locations.map((location) => (
                <li key={location.id} className="flex items-start gap-2 rounded-lg border border-line p-3 text-[13px]">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />
                  <div><b className="text-navy">{location.name}</b><p className="text-[12.5px] text-muted">{location.addressLine1}{location.area ? `, ${location.area}` : ''} {location.pincode}{location.openingHours ? ` · ${location.openingHours}` : ''}</p></div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="card p-6">
            <div className="flex items-center gap-2"><Home size={17} className="text-teal-700" aria-hidden /><h2 className="text-[16px] font-bold">Covered areas</h2></div>
            {active.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">Home collection areas are being configured.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {active.map((area) => <li key={area.id}><span className="badge badge-gray">{area.name}</span></li>)}
              </ul>
            )}
            <p className="mt-3 text-[12px] leading-5 text-muted">Collection fee: {settings.collectionFeePaise > 0 ? formatINR(settings.collectionFeePaise) : 'no separate fee'}. The fee is added once per booking when applicable.</p>
            <Link href="/service-areas" className="btn btn-outline btn-sm mt-3 w-full">See all service areas</Link>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-2"><Truck size={17} className="text-teal-700" aria-hidden /><h2 className="text-[16px] font-bold">Need help?</h2></div>
            <p className="mt-2 text-[13px] leading-6 text-muted">If your area is not listed, call us and we will tell you whether collection is possible.</p>
            {settings.supportPhone && <a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="btn btn-primary btn-sm mt-3 w-full"><Stethoscope size={14} aria-hidden /> {settings.supportPhone}</a>}
          </div>
        </aside>
      </div>
    </StorefrontShell>
  )
}
