'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { HOMEPAGE_FAQS } from '@/lib/storefront/content'

/**
 * Accessible accordion. One panel open at a time, controlled buttons with
 * aria-expanded / aria-controls, and the panel height animates via grid rows
 * so it works without measuring.
 */
export function FaqAccordion({ items = HOMEPAGE_FAQS, showAllLink = true }: { items?: typeof HOMEPAGE_FAQS; showAllLink?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null)

  return (
    <div>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
        {items.map((item) => {
          const open = openId === item.id
          return (
            <div key={item.id}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                  aria-controls={`faq-panel-${item.id}`}
                  id={`faq-button-${item.id}`}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[13.5px] font-semibold text-ink transition hover:bg-section sm:px-5"
                >
                  {item.question}
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full transition ${open ? 'bg-forest text-white' : 'bg-mint-50 text-mint-700'}`}>
                    {open ? <Minus size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                  </span>
                </button>
              </h3>
              <div
                id={`faq-panel-${item.id}`}
                role="region"
                aria-labelledby={`faq-button-${item.id}`}
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-[13px] leading-6 text-muted sm:px-5">{item.answer}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {showAllLink && (
        <Link href="/faq" className="mt-3 inline-block text-[13px] font-semibold text-green hover:underline">
          See all frequently asked questions →
        </Link>
      )}
    </div>
  )
}
