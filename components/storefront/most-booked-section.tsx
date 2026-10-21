import Link from 'next/link'
import { ArrowRight, Cpu, Radar, Thermometer } from 'lucide-react'
import { CategoryTiles } from '@/components/storefront/category-tiles'

/** Two-column section: editorial on the left, gradient category tiles right. */
export function MostBookedSection({ cityName }: { cityName: string }) {
  return (
    <section className="section-y" aria-labelledby="most-booked-heading">
      <div className="container-x grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <span className="eyebrow">Curated checkup bundles</span>
          <h2 id="most-booked-heading" className="section-heading mt-1.5">Most Booked Checkups</h2>
          <p className="mt-3 max-w-lg text-[14px] leading-6 text-muted">
            Checkups that bundle the tests doctors request most, so one appointment covers the full picture. Sample handling is
            temperature-controlled end to end, and results are checked against reference ranges before they reach your report.
          </p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Cpu, label: 'Instrument-led analysis', value: 'Automated analysers' },
              { icon: Thermometer, label: 'Cold-chain handling', value: 'Temperature tracked' },
              { icon: Radar, label: 'Every result checked', value: 'Reference ranges' },
            ].map(({ icon: Icon, label, value }) => (
              <li key={label} className="rounded-tile border border-line bg-white p-3 shadow-card">
                <Icon size={17} className="text-green" aria-hidden />
                <b className="mt-2 block text-[12.5px] font-semibold text-ink">{label}</b>
                <span className="text-[11px] text-muted">{value}</span>
              </li>
            ))}
          </ul>

          <Link href="/packages" className="btn btn-outline-green mt-6">
            View All Checkups <ArrowRight size={15} aria-hidden />
          </Link>
          <p className="mt-3 text-[11.5px] text-muted">Prices shown apply in {cityName}.</p>
        </div>

        <CategoryTiles />
      </div>
    </section>
  )
}
