import type { Metadata } from 'next'
import { Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { ContactForm } from '@/components/site/contact-form'
import { PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: 'Contact', description: 'Contact SV Diagnostics in Hyderabad for appointments, test availability and report queries.' }
export const revalidate = 60

export default async function ContactPage() {
  const { settings, locations } = await siteShell()
  const subjects = ['General enquiry', 'Test availability', 'Home collection', 'Existing booking', 'Report query', 'Billing']

  return (
    <SiteShell settings={settings}>
      <PageHeader
        title="Contact Us"
        description="Questions about a test, a home visit or an existing booking? Send us a message or call during laboratory hours."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
      />
      <div className="container-x grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
        <ContactForm subjects={subjects} />
        <aside className="space-y-5">
          <section className="card p-6">
            <h2 className="text-[16px] font-bold">Reach us</h2>
            <ul className="mt-3 space-y-3 text-[13.5px] text-muted">
              {settings.supportPhone && <li><a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="flex items-start gap-2.5 hover:text-teal-700"><Phone size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden /><span><b className="block text-ink">Phone</b>{settings.supportPhone}</span></a></li>}
              {settings.supportEmail && <li><a href={`mailto:${settings.supportEmail}`} className="flex items-start gap-2.5 hover:text-teal-700"><Mail size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden /><span><b className="block text-ink">Email</b>{settings.supportEmail}</span></a></li>}
              {settings.openingHours && <li className="flex items-start gap-2.5"><Clock3 size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden /><span><b className="block text-ink">Hours</b>{settings.openingHours}</span></li>}
              {settings.address && <li className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden /><span><b className="block text-ink">Address</b>{settings.address}</span></li>}
            </ul>
          </section>
          {locations.length > 0 && (
            <section className="card p-6">
              <h2 className="text-[16px] font-bold">Our locations</h2>
              <ul className="mt-3 space-y-3">
                {locations.map((location) => (
                  <li key={location.id} className="rounded-lg border border-line p-3 text-[13px]">
                    <b className="text-navy">{location.name}</b>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{location.addressLine1}{location.addressLine2 ? `, ${location.addressLine2}` : ''}{location.area ? `, ${location.area}` : ''} {location.pincode}</p>
                    {location.phone && <a href={`tel:${location.phone.replace(/\s/g, '')}`} className="link text-[12.5px]">{location.phone}</a>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card p-6">
            <h2 className="text-[16px] font-bold">Medical emergencies</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">SV Diagnostics does not provide emergency care. In an emergency, call your local emergency helpline or visit the nearest hospital.</p>
          </section>
        </aside>
      </div>
    </SiteShell>
  )
}
