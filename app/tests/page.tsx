import { Suspense } from 'react'
import type { Metadata } from 'next'
import { listCategories, listTests } from '@/lib/catalogue'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { TestsBrowser } from '@/components/site/tests-browser'
import { PageHeader, Skeletons } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Diagnostic Tests',
  description: 'Browse diagnostic tests at SV Diagnostics with live prices, sample types and report times. Book a laboratory visit or home sample collection.',
}

export default async function TestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const category = typeof params.category === 'string' ? params.category : 'all'
  const sort = typeof params.sort === 'string' && ['name', 'price_asc', 'price_desc'].includes(params.sort) ? params.sort as 'name' | 'price_asc' | 'price_desc' : 'name'
  const page = Number(typeof params.page === 'string' ? params.page : 1) || 1

  const [{ settings }, categories, initial] = await Promise.all([
    siteShell(),
    listCategories(),
    listTests({ q, category, sort, page, pageSize: 12 }),
  ])

  return (
    <SiteShell settings={settings}>
      <PageHeader
        title="Diagnostic Tests"
        description={`Browse our published catalogue and book a laboratory visit or an eligible home sample collection across ${settings.city}. Prices are shown exactly as configured by the laboratory.`}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Diagnostic tests' }]}
      />
      <Suspense fallback={<div className="container-x py-8"><Skeletons count={6} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" /></div>}>
        <TestsBrowser categories={categories} initial={initial} />
      </Suspense>
    </SiteShell>
  )
}
