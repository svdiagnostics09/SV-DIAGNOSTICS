import type { Metadata } from 'next'
import { listAllPublishedTests, listCategories } from '@/lib/catalogue'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { PriceList } from '@/components/site/price-list'
import { PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: 'Price List', description: 'Searchable diagnostic test price list for SV Diagnostics, Hyderabad.' }
export const revalidate = 60

export default async function PriceListPage() {
  const [{ settings }, categories, tests] = await Promise.all([siteShell(), listCategories(), listAllPublishedTests()])

  return (
    <StorefrontShell settings={settings}>
      <PageHeader
        title="Price List"
        description="Every published investigation with its current price. Search by name or filter by category — the same records and prices used at checkout."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Price list' }]}
      />
      <PriceList tests={tests} categories={categories} />
    </StorefrontShell>
  )
}
