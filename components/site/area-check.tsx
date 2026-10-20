'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { formatINR } from '@/lib/format'

interface Area { name: string; pincodes: string[]; feePaise: number }

/** Pincode coverage check against the active service areas. */
export function AreaCheck({ areas }: { areas: Area[] }) {
  const [pincode, setPincode] = useState('')
  const [checked, setChecked] = useState(false)
  const match = areas.find((area) => area.pincodes.includes(pincode.trim()))

  return (
    <form
      className="mt-3"
      onSubmit={(event) => { event.preventDefault(); setChecked(pincode.trim().length === 6) }}
    >
      <label htmlFor="area-pincode" className="sr-only">Pincode</label>
      <div className="flex gap-2">
        <input
          id="area-pincode"
          value={pincode}
          onChange={(event) => { setPincode(event.target.value.replace(/\D/g, '').slice(0, 6)); setChecked(false) }}
          inputMode="numeric"
          placeholder="Enter pincode"
          className="input h-11 bg-white"
          aria-describedby="area-result"
        />
        <button type="submit" disabled={pincode.length !== 6} className="btn btn-primary h-11">Check</button>
      </div>
      <div id="area-result" aria-live="polite">
        {checked && (match ? (
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] font-medium text-[#0f766b]">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden />
            Home collection is available in {match.name}{match.feePaise > 0 ? ` · ${formatINR(match.feePaise)} collection fee` : ' · no separate collection fee'}.
            <Link href="/tests" className="ml-1 underline">Book a test</Link>
          </p>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] font-medium text-[#92400e]">
            <XCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
            We don’t cover this pincode yet. You can still <Link href="/locations" className="underline">book a laboratory visit</Link>.
          </p>
        ))}
        {checked && pincode.length !== 6 && <p className="mt-2 text-[12px] text-muted">Enter a 6-digit pincode.</p>}
      </div>
    </form>
  )
}
