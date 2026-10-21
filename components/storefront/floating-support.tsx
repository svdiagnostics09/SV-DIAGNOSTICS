'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Headphones, MessageCircle, Phone, X } from 'lucide-react'

/**
 * Floating support launcher bottom-right. Opens a small panel with the routes
 * that actually resolve (support line, contact form, tracking).
 */
export function FloatingSupportButton({ supportPhone }: { supportPhone: string }) {
  const [open, setOpen] = useState(false)
  const tel = supportPhone ? supportPhone.replace(/\s/g, '') : null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {open && (
        <div className="w-[260px] overflow-hidden rounded-2xl border border-line bg-white shadow-float animate-[pop-in_.18s_ease]">
          <div className="flex items-center justify-between gap-2 bg-band-forest px-3.5 py-2.5 text-white">
            <b className="text-[12.5px] font-semibold">Need a hand?</b>
            <button type="button" onClick={() => setOpen(false)} className="grid size-6 place-items-center rounded-full hover:bg-white/15" aria-label="Close support panel">
              <X size={13} aria-hidden />
            </button>
          </div>
          <div className="p-2">
            {tel && (
              <a href={`tel:${tel}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-ink transition hover:bg-section">
                <Phone size={14} className="text-green" aria-hidden /> Call {supportPhone}
              </a>
            )}
            <Link href="/contact" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-ink transition hover:bg-section">
              <MessageCircle size={14} className="text-green" aria-hidden /> Send us a message
            </Link>
            <Link href="/track" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-ink transition hover:bg-section">
              <Headphones size={14} className="text-green" aria-hidden /> Track a booking
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close support panel' : 'Open support options'}
        className="grid size-13 place-items-center rounded-full bg-forest text-white shadow-float transition hover:bg-forest-800 hover:scale-[1.04]"
        style={{ width: 52, height: 52 }}
      >
        {open ? <X size={21} aria-hidden /> : <Headphones size={22} aria-hidden />}
      </button>
    </div>
  )
}
