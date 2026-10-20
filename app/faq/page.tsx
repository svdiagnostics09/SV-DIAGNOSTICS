import type { Metadata } from 'next'
import Link from 'next/link'
import { listFaqs } from '@/lib/content'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { PageHeader, EmptyState } from '@/components/ui'
import { HelpCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'FAQ', description: 'Frequently asked questions about booking tests, home collection, reports and payments at SV Diagnostics.' }
export const dynamic = 'force-dynamic'

export default async function FaqPage() {
  const [{ settings }, faqs] = await Promise.all([siteShell(), listFaqs()])
  const groups = faqs.reduce<Record<string, typeof faqs>>((acc, faq) => { (acc[faq.category] ??= []).push(faq); return acc }, {})

  return (
    <SiteShell settings={settings}>
      <PageHeader title="Frequently Asked Questions" description="Answers configured by our team. If something is missing, contact us and we will add it." breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]} />
      <div className="container-x max-w-3xl py-8">
        {faqs.length === 0 ? (
          <div className="card"><EmptyState icon={HelpCircle} title="No FAQs published yet" description="Send us your question and we will answer it directly." action={<Link href="/contact" className="btn btn-primary btn-sm">Contact us</Link>} /></div>
        ) : Object.entries(groups).map(([category, items]) => (
          <section key={category} className="mb-8">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-teal-700">{category}</h2>
            <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-white">
              {items.map((faq) => (
                <details key={faq.id} className="group px-4 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-semibold text-navy">
                    {faq.question}
                    <span aria-hidden className="text-lg leading-none text-muted group-open:hidden">+</span>
                    <span aria-hidden className="hidden text-lg leading-none text-muted group-open:inline">−</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-[13.5px] leading-6 text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <div className="card flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div><b className="text-[14px] font-semibold text-navy">Still have a question?</b><p className="text-[12.5px] text-muted">Our team replies during laboratory hours.</p></div>
          <Link href="/contact" className="btn btn-primary btn-sm">Contact us</Link>
        </div>
      </div>
    </SiteShell>
  )
}
