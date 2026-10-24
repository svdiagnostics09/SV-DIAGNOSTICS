import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { listPackages, listTests } from '@/lib/catalogue'
import { listPublicPartners } from '@/lib/partners'
import { siteShell } from '@/lib/page-data'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { HeroBanner } from '@/components/storefront/hero-banner'
import { SearchPanel } from '@/components/storefront/search-panel'
import { ProductCarousel } from '@/components/storefront/product-carousel'
import { PromoBanner } from '@/components/storefront/promo-banner'
import { MostBookedSection } from '@/components/storefront/most-booked-section'
import { BrandExperience } from '@/components/storefront/brand-experience'
import { FeaturedTestBanner } from '@/components/storefront/featured-test-banner'
import { HealthCategoriesSection } from '@/components/storefront/health-categories'
import { PartnersMarquee } from '@/components/storefront/partners-marquee'
import { Testimonials } from '@/components/storefront/testimonials'
import { SeoContent } from '@/components/storefront/seo-content'
import { fromPackage, fromTest, type StoreProduct } from '@/lib/storefront/product'

export const revalidate = 60

/** Section heading with a "view all" link, shared by both carousels. */
function SectionHeader({ id, title, description, href, linkLabel }: { id: string; title: string; description?: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="section-heading">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-green hover:underline">
        {linkLabel} <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  )
}

export default async function HomePage() {
  const [{ settings }, testResult, packages, requestHeaders, partners] = await Promise.all([
    siteShell(),
    listTests({ pageSize: 24 }),
    listPackages(),
    headers(),
    // A missing partners table (migration not run yet) must not break the home
    // page — the section simply does not render.
    listPublicPartners().catch(() => []),
  ])

  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const origin = `${host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'}://${host}`

  const testProducts: StoreProduct[] = testResult.tests.map(fromTest)
  const packageProducts: StoreProduct[] = packages.map(fromPackage)

  // Prefer popular items, but always fill the rail so a small catalogue still shows products.
  const popularTests = [...testProducts]
    .sort((a, b) => Number(Boolean(b.isPopular)) - Number(Boolean(a.isPopular)))
    .slice(0, 8)
  const featuredTests = [...testProducts]
    .sort((a, b) => (b.listPricePaise - b.pricePaise) - (a.listPricePaise - a.pricePaise))
    .slice(0, 4)

  const cheapestCheckup = packageProducts.reduce<StoreProduct | null>(
    (cheapest, item) => (!cheapest || item.pricePaise < cheapest.pricePaise ? item : cheapest),
    null,
  )

  const initialSearch = {
    tests: popularTests.slice(0, 6),
    packages: packageProducts.slice(0, 6),
  }

  return (
    <StorefrontShell settings={settings}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MedicalBusiness',
          name: settings.brandName,
          description: settings.aboutText,
          address: { '@type': 'PostalAddress', addressLocality: settings.city, addressRegion: settings.state, streetAddress: settings.address },
          telephone: settings.supportPhone || undefined,
          url: origin,
        }).replace(/</g, '\\u003c'),
      }} />

      <HeroBanner startingPricePaise={cheapestCheckup?.pricePaise ?? 159900} />
      <SearchPanel initial={initialSearch} />

      {/* §5 — Full body checkups carousel */}
      <section className="mt-8 bg-section section-y" aria-labelledby="checkups-heading">
        <div className="container-x">
          <SectionHeader
            id="checkups-heading"
            title={`Full Body Checkups in ${settings.city}`}
            description="Bundled panels covering the markers doctors ask for most."
            href="/packages"
            linkLabel="All checkups"
          />
          <ProductCarousel products={packageProducts} label={`Checkups in ${settings.city}`} emptyMessage="No checkup packages are published yet" />
        </div>
      </section>

      {/* §6 */}
      <MostBookedSection cityName={settings.city} />

      {/* §7 */}
      <FeaturedTestBanner products={featuredTests} />

      {/* §8 */}
      <PromoBanner />

      {/* §9 — Most booked lab tests */}
      <section className="mt-8 bg-section section-y" aria-labelledby="tests-heading">
        <div className="container-x">
          <SectionHeader
            id="tests-heading"
            title={`Most Booked Tests in ${settings.city}`}
            description="Individual tests collected at home or in the laboratory."
            href="/tests"
            linkLabel="All tests"
          />
          <ProductCarousel products={popularTests} label={`Lab tests in ${settings.city}`} emptyMessage="No lab tests are published yet" />
        </div>
      </section>

      {/* §10 */}
      <BrandExperience brandName={settings.brandName} />

      {/* §11 */}
      <HealthCategoriesSection />

      {/* §12 — Partners marquee */}
      <PartnersMarquee partners={partners} />

      {/* §13 */}
      <Testimonials />

      {/* §14 */}
      <SeoContent cityName={settings.city} />
    </StorefrontShell>
  )
}
