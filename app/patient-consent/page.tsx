import type { Metadata } from 'next'
import Link from 'next/link'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: 'Patient Consent', description: 'Patient consent and information for diagnostic testing at SV Diagnostics.' }

const SECTIONS = [
  { title: 'Consent to testing', body: 'By booking, you confirm that you are the patient or an authorised representative of the patient, that the details supplied are accurate, and that you consent to sample collection and testing for the named patient.' },
  { title: 'What you are consenting to', body: 'Collection of blood, urine or other samples as required by the selected tests; processing of those samples in our laboratory; and release of results to the contact details you provided, or through the booking tracking page using your booking reference and registered mobile number.' },
  { title: 'Information we collect', body: 'Patient name, age, gender, mobile number, optional email address, collection address, selected tests, appointment slot, payment records and booking updates. Clinical data is stored only where required for results and service delivery.' },
  { title: 'Who can see your results', body: 'Authorised laboratory staff for the purpose of processing and releasing results. Results are not shared with third parties unless required by law or with your explicit instruction.' },
  { title: 'Withdrawing consent', body: 'You may withdraw consent before collection by cancelling the booking or contacting the laboratory. Once a sample has been processed, results may already form part of a clinical record; contact us to discuss deletion where applicable.' },
  { title: 'Safety and eligibility', body: 'Some tests require a laboratory visit, a prescription, or specific preparation. Our team may decline or reschedule a home collection if it is not safe or suitable.' },
  { title: 'Your responsibilities', body: 'Provide accurate identity and contact details, follow preparation instructions, and inform the collector of any relevant medication or health conditions. This website does not provide emergency or clinical advice.' },
]

export default async function PatientConsentPage() {
  const { settings } = await siteShell()
  return (
    <StorefrontShell settings={settings}>
      <PageHeader title="Patient Consent Information" description={`Consent version ${settings.consentVersion}. This page mirrors the consent recorded with every booking.`} breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Patient consent' }]} />
      <div className="container-x max-w-3xl py-8 space-y-4">
        <div className="card p-6">
          <h2 className="text-[16px] font-bold">Consent recorded at booking</h2>
          <p className="mt-2 text-[13.5px] leading-7 text-muted">{settings.patientConsentText}</p>
        </div>
        {SECTIONS.map((section) => (
          <section key={section.title} className="card p-6">
            <h2 className="text-[15px] font-bold">{section.title}</h2>
            <p className="mt-2 text-[13.5px] leading-7 text-muted">{section.body}</p>
          </section>
        ))}
        <p className="text-[12.5px] text-muted">Questions? <Link href="/contact" className="link">Contact the laboratory</Link> or read our <Link href="/privacy" className="link">privacy policy</Link>.</p>
      </div>
    </StorefrontShell>
  )
}
