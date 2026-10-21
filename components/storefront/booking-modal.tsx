'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CalendarCheck, CheckCircle2, Info, Loader2, MapPin } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { useCart } from '@/components/cart-provider'
import { useCity } from '@/components/storefront/city-provider'
import { useStoreUI } from '@/components/storefront/ui-provider'
import { Overlay } from '@/components/storefront/overlay'

type Status = 'form' | 'submitting' | 'done'

/**
 * DEMO booking flow. It validates and simulates a request client-side; no
 * appointment is created and no payment is taken. The banner at the top says so.
 */
export function BookingModal() {
  const { booking, bookingOpen, closeBooking } = useStoreUI()
  const cart = useCart()
  const { city } = useCity()
  const [status, setStatus] = useState<Status>('form')
  const [form, setForm] = useState({ name: '', phone: '', pincode: '', slot: 'morning' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const items = booking ? [booking] : cart.items
  const total = booking ? booking.pricePaise : cart.subtotalPaise

  const close = () => { closeBooking(); setStatus('form'); setErrors({}) }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Enter the patient name'
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) next.phone = 'Enter a valid 10-digit mobile number'
    if (!/^\d{6}$/.test(form.pincode)) next.pincode = 'Enter a 6-digit pincode'
    setErrors(next)
    if (Object.keys(next).length) return
    setStatus('submitting')
    window.setTimeout(() => setStatus('done'), 900)
  }

  return (
    <Overlay open={bookingOpen} onClose={close} labelledBy="booking-title" className="max-w-lg">
      <div className="border-b border-line px-5 py-4 pr-12 sm:px-6">
        <h2 id="booking-title" className="text-[15px] font-bold text-ink">Start a booking</h2>
        <p className="mt-0.5 text-[11.5px] text-muted">Home collection or lab visit in {city.name}.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        <p className="flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-[11.5px] leading-5 text-[#8a4b00]">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span><b className="font-semibold">Demo flow.</b> This form does not create a real appointment or take payment. Use the full booking form to reserve a slot.</span>
        </p>

        {status === 'done' ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-mint-50 text-mint-700"><CheckCircle2 size={24} aria-hidden /></span>
            <p className="mt-3 text-[14px] font-bold text-ink">Details captured — demo only</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] leading-5 text-muted">
              Nothing was booked. Continue to the live booking form to choose a real slot and confirm your appointment.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/book" onClick={close} className="btn btn-primary">Go to the booking form <ArrowRight size={15} aria-hidden /></Link>
              <button type="button" onClick={close} className="btn btn-ghost btn-sm">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
            {items.length > 0 && (
              <div className="rounded-lg border border-line bg-surface px-3 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Selected</p>
                <ul className="mt-1 space-y-0.5">
                  {items.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="flex justify-between gap-2 text-[12px] text-ink">
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 tabular-nums">{formatINR(item.pricePaise * ('quantity' in item ? (item.quantity ?? 1) : 1))}</span>
                    </li>
                  ))}
                </ul>
                {!booking && <p className="mt-1 flex justify-between border-t border-line pt-1 text-[12px] font-bold text-ink"><span>Subtotal</span><span className="tabular-nums">{formatINR(total)}</span></p>}
              </div>
            )}

            <div>
              <label htmlFor="booking-name" className="label">Patient name</label>
              <input id="booking-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" autoComplete="name" aria-invalid={Boolean(errors.name)} data-autofocus />
              {errors.name && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="booking-phone" className="label">Mobile number</label>
                <input id="booking-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="input" inputMode="tel" autoComplete="tel" placeholder="98765 43210" aria-invalid={Boolean(errors.phone)} />
                {errors.phone && <p className="mt-1 text-[11px] text-danger">{errors.phone}</p>}
              </div>
              <div>
                <label htmlFor="booking-pincode" className="label">Pincode</label>
                <input id="booking-pincode" value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} className="input" inputMode="numeric" placeholder="500081" aria-invalid={Boolean(errors.pincode)} />
                {errors.pincode && <p className="mt-1 text-[11px] text-danger">{errors.pincode}</p>}
              </div>
            </div>

            <fieldset>
              <legend className="label">Preferred time</legend>
              <div className="grid grid-cols-3 gap-2">
                {[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']].map(([value, label]) => (
                  <label key={value} className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-[12px] font-medium transition ${form.slot === value ? 'border-mint bg-mint-50 text-mint-700' : 'border-line text-ink hover:border-muted/40'}`}>
                    <input type="radio" name="slot" value={value} checked={form.slot === value} onChange={() => setForm({ ...form, slot: value })} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="btn btn-primary w-full" disabled={status === 'submitting'}>
              {status === 'submitting' ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Checking…</> : <><CalendarCheck size={15} aria-hidden /> Continue</>}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <MapPin size={11} aria-hidden /> Availability is confirmed on the booking form.
            </p>
          </form>
        )}
      </div>
    </Overlay>
  )
}
