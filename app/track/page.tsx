import type { Metadata } from 'next'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { TrackBooking } from '@/components/site/track-booking'
import { PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: 'Track a Booking', description: 'Check the status of your SV Diagnostics booking with your reference and registered mobile number.' }
export const dynamic = 'force-dynamic'

export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ settings }, query] = await Promise.all([siteShell(), searchParams])
  const reference = typeof query.ref === 'string' ? query.ref.toUpperCase() : ''
  const phone = typeof query.phone === 'string' ? query.phone : ''
  return (
    <StorefrontShell settings={settings}>
      <PageHeader title="Track Your Booking" description="See the current status of your booking, your appointment details and any updates from the laboratory." breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Track booking' }]} />
      <div className="container-x max-w-2xl py-8">
        <TrackBooking initialReference={reference} initialPhone={phone} cancellationWindowHours={settings.cancellationWindowHours} />
        <p className="mt-4 text-[11.5px] leading-5 text-muted">For privacy, we require both the booking reference and the registered mobile number. If you no longer have either, contact the laboratory and we will help verify your booking.</p>
      </div>
    </StorefrontShell>
  )
}
