import { Suspense } from 'react'
import type { Metadata } from 'next'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { BookingWizard } from '@/components/booking/booking-wizard'
import type { BookingConfigShape } from '@/lib/booking-config'

export const metadata: Metadata = { title: 'Book a Test', description: 'Complete your diagnostic booking at SV Diagnostics.' }
export const dynamic = 'force-dynamic'

export default async function BookPage() {
  const { settings, locations, areas } = await siteShell()
  return (
    <SiteShell settings={settings}>
      <Suspense fallback={<div className="container-x py-10"><div className="skeleton h-64 w-full" /></div>}>
        <BookingWizard
          config={{
            payOnline: settings.payOnlineEnabled,
            payAtLab: settings.payAtLabEnabled,
            payAtHome: settings.payAtHomeEnabled,
            collectionEnabled: settings.collectionEnabled,
            collectionFeePaise: settings.collectionFeePaise,
            consentText: settings.patientConsentText,
            termsText: settings.bookingTermsText,
            supportPhone: settings.supportPhone,
            brandName: settings.brandName,
            city: settings.city,
          } satisfies BookingConfigShape}
          locations={locations}
          areas={areas}
        />
      </Suspense>
    </SiteShell>
  )
}
