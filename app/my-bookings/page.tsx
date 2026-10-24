import type { Metadata } from 'next'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { MyBookings } from '@/components/site/my-bookings'
import { PageHeader } from '@/components/ui'

export const metadata: Metadata = {
  title: 'My Bookings',
  description: 'Find every SV Diagnostics booking linked to your mobile number — appointment, payment and report status.',
}
export const dynamic = 'force-dynamic'

export default async function MyBookingsPage() {
  const { settings } = await siteShell()
  return (
    <StorefrontShell settings={settings}>
      <PageHeader
        title="My Bookings"
        description="Enter the mobile number you booked with to see your appointments and reports."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'My bookings' }]}
      />
      <div className="container-x max-w-2xl py-8">
        <MyBookings />
        <p className="mt-4 text-[11.5px] leading-5 text-muted">
          Looking for a single booking? You can also <a href="/track" className="font-semibold text-green hover:underline">track it with your reference number</a>.
        </p>
      </div>
    </StorefrontShell>
  )
}
