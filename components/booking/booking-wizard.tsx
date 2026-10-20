'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, ShoppingBag, Trash2 } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import type { TestView } from '@/lib/catalogue'
import type { LocationView, ServiceAreaView } from '@/lib/network'
import type { BookingConfigShape } from '@/lib/booking-config'
import { formatINR } from '@/lib/format'

interface AvailabilityDay { date: string; label: string; weekday: number; slots: Array<{ id: number; label: string; startTime: string; remaining: number; capacity: number; available: boolean }> }

type PaymentMethod = 'online' | 'pay_lab' | 'pay_home'

const STEPS = ['Tests', 'Collection', 'Slot', 'Patient', 'Confirm'] as const

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Five-step booking flow. The summary is a preview; the server recalculates
 * every amount (and re-checks capacity) when the booking is created.
 */
export function BookingWizard({ config, locations, areas }: { config: BookingConfigShape; locations: LocationView[]; areas: ServiceAreaView[] }) {
  const searchParams = useSearchParams()
  const presetTestId = Number(searchParams.get('test') ?? '')
  const cart = useCart()
  const [step, setStep] = useState(0)
  const [method, setMethod] = useState<'home' | 'lab'>(config.collectionEnabled ? 'home' : 'lab')
  const [locationId, setLocationId] = useState<number | null>(locations[0]?.id ?? null)
  const [pincode, setPincode] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [addressArea, setAddressArea] = useState('')
  const [days, setDays] = useState<AvailabilityDay[]>([])
  const [availabilityState, setAvailabilityState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [date, setDate] = useState('')
  const [slotId, setSlotId] = useState<number | null>(null)
  const [patient, setPatient] = useState({ patientName: '', patientAge: '', patientGender: '', phone: '', email: '' })
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(config.payOnline ? 'online' : config.payAtLab ? 'pay_lab' : 'pay_home')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [catalog, setCatalog] = useState<TestView[]>([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)

  const area = areas.find((item) => item.homeCollection && item.pincodes.includes(pincode.trim()))
  const collectionFee = method === 'home' ? config.collectionFeePaise : 0
  const previewTotal = cart.subtotalPaise + collectionFee

  // A test chosen from its detail page is added to the booking automatically.
  useEffect(() => {
    if (!Number.isInteger(presetTestId) || presetTestId <= 0 || !cart.ready || cart.has('test', presetTestId)) return
    fetch('/api/catalogue?pageSize=500').then((response) => response.json()).then((body) => {
      const test = (body.tests as TestView[] | undefined)?.find((item) => item.id === presetTestId)
      if (test) cart.add({ kind: 'test', id: test.id, name: test.name, pricePaise: test.listPricePaise, homeCollection: test.homeCollection })
    }).catch(() => undefined)
  }, [presetTestId, cart])

  useEffect(() => {
    if (step !== 0 || catalog.length > 0) return
    const controller = new AbortController()
    fetch('/api/catalogue?pageSize=40', { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => { setCatalog(body.tests ?? []); setCatalogLoading(false) })
      .catch(() => setCatalogLoading(false))
    return () => controller.abort()
  }, [step, catalog.length])

  useEffect(() => {
    if (method === 'home' && !area) { setDays([]); setAvailabilityState(pincode.length === 6 ? 'ready' : 'loading'); return }
    if (method === 'lab' && !locationId) { setDays([]); setAvailabilityState('ready'); return }
    const controller = new AbortController()
    setAvailabilityState('loading')
    fetch(`/api/availability?method=${method}${method === 'lab' ? `&locationId=${locationId}` : ''}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('failed')
        const body = await response.json() as { dates: AvailabilityDay[] }
        setDays(body.dates)
        setAvailabilityState('ready')
        setDate((current) => (current && body.dates.some((day) => day.date === current) ? current : ''))
        setSlotId(null)
      })
      .catch((err) => { if ((err as Error).name !== 'AbortError') setAvailabilityState('error') })
    return () => controller.abort()
  }, [method, area, locationId, pincode.length])

  const daySlots = days.find((day) => day.date === date)?.slots ?? []

  const validateStep = () => {
    const next: Record<string, string> = {}
    if (step === 0) {
      if (cart.items.length === 0) next.items = 'Add at least one test or package to continue.'
      else if (method === 'home' && cart.items.some((item) => !item.homeCollection)) next.items = 'One of your tests needs a laboratory visit. Switch to “Laboratory visit” or remove it.'
    }
    if (step === 1) {
      if (method === 'home') {
        if (!/^[1-9]\d{5}$/.test(pincode.trim())) next.pincode = 'Enter a valid 6-digit pincode.'
        else if (!areas.length) next.pincode = 'Home collection areas are not configured yet. Please choose a laboratory visit.'
        else if (!area) next.pincode = `Home collection is not available for ${pincode}. Choose a listed area or a laboratory visit.`
        if (addressLine.trim().length < 6) next.addressLine = 'Enter the house / building and street.'
      }
      if (method === 'lab' && !locationId) next.locationId = 'Choose a laboratory.'
    }
    if (step === 2) {
      if (!date) next.slot = 'Choose an available date.'
      else if (!daySlots.some((slot) => slot.available)) next.slot = 'No open slots on this date — choose another.'
      else if (!slotId) next.slot = 'Choose an available time slot.'
    }
    if (step === 3) {
      if (patient.patientName.trim().length < 2) next.patientName = 'Enter the patient’s full name.'
      if (!/^(\+91)?[6-9]\d{9}$/.test(patient.phone.replace(/[\s()-]/g, ''))) next.phone = 'Enter a valid 10-digit mobile number.'
      if (patient.email && !/^\S+@\S+\.\S+$/.test(patient.email)) next.email = 'Enter a valid email address or leave it blank.'
    }
    if (step === 4 && !consent) next.consent = 'Please accept the consent and booking terms.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const next = () => {
    setError(null)
    if (!validateStep()) return
    if (step === 4) { void submit(); return }
    setStep((value) => value + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const payload = {
      items: cart.items.map((item) => ({ kind: item.kind, id: item.id, quantity: 1 })),
      method,
      locationId: method === 'lab' ? locationId : null,
      pincode: method === 'home' ? pincode.trim() : '',
      addressLine: method === 'home' ? addressLine.trim() : '',
      addressArea: method === 'home' ? addressArea.trim() : '',
      date,
      slotId,
      patientName: patient.patientName.trim(),
      patientAge: patient.patientAge ? Number(patient.patientAge) : null,
      patientGender: patient.patientGender || null,
      phone: patient.phone.trim(),
      email: patient.email.trim() || '',
      paymentMethod,
      consent: true,
      idempotencyKey: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `bk-${Date.now()}-${Math.random()}`,
    }
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' }, body: JSON.stringify(payload) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setBusy(false)
      setError(body.error ?? 'The booking could not be completed.')
      if (body.code === 'slot_full' || body.code === 'slot_unavailable') { setStep(2); setSlotId(null) }
      return
    }

    // Online payment is confirmed only by the server-verified callback.
    if (paymentMethod === 'online' && body.payment?.orderId) {
      const ready = await loadRazorpay()
      if (!ready) {
        cart.clear()
        window.location.assign(`${body.confirmationUrl}&payment=PENDING`)
        return
      }
      const Razorpay = (window as unknown as { Razorpay: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay
      new Razorpay({
        key: body.payment.keyId,
        amount: body.payment.amountPaise,
        currency: 'INR',
        name: config.brandName,
        description: `Booking ${body.reference}`,
        order_id: body.payment.orderId,
        prefill: { name: patient.patientName, contact: patient.phone, email: patient.email || undefined },
        theme: { color: '#20A99C' },
        handler: async (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verify = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' }, body: JSON.stringify({ ...result, reference: body.reference, accessToken: body.accessToken }) })
          cart.clear()
          window.location.assign(`${body.confirmationUrl}&payment=${verify.ok ? 'PAID' : 'FAILED'}`)
        },
        modal: { ondismiss: () => { cart.clear(); window.location.assign(`${body.confirmationUrl}&payment=CANCELLED`) } },
      }).open()
      return
    }

    cart.clear()
    window.location.assign(body.confirmationUrl)
  }

  const relevantAreas = areas.filter((item) => item.homeCollection)

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em] sm:text-[1.75rem]">Book your test</h1>
          <p className="text-[13px] text-muted">Prices, availability and totals are verified on our server.</p>
        </div>
        <ol className="flex flex-wrap items-center gap-1.5 text-[11.5px]" aria-label="Booking steps">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-1.5">
              <span aria-current={index === step ? 'step' : undefined} className={`grid size-6 place-items-center rounded-full font-bold ${index < step ? 'bg-teal text-white' : index === step ? 'bg-navy text-white' : 'bg-[#e8eef8] text-muted'}`}>{index < step ? <Check size={12} aria-hidden /> : index + 1}</span>
              <span className={index === step ? 'font-semibold text-navy' : 'text-muted'}>{label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="card p-5 sm:p-6">
          {step === 0 && (
            <section aria-labelledby="step-tests">
              <h2 id="step-tests" className="text-[16px] font-bold">Your tests and packages</h2>
              {cart.items.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-line p-6 text-center">
                  <ShoppingBag size={22} className="mx-auto text-muted" aria-hidden />
                  <p className="mt-2 text-[13.5px] font-semibold">Your booking is empty</p>
                  <p className="mt-1 text-[12.5px] text-muted">Add a test below, or browse the full catalogue.</p>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {cart.items.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <b className="block text-[13.5px] font-semibold text-navy">{item.name}</b>
                        <span className="text-[11.5px] capitalize text-muted">{item.kind}{item.homeCollection ? ' · home collection available' : ' · laboratory only'}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[13.5px] font-semibold tabular-nums">{formatINR(item.pricePaise)}</span>
                        <button type="button" onClick={() => { cart.remove(item.kind, item.id); setErrors({}) }} className="grid size-8 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label={`Remove ${item.name}`}><Trash2 size={14} aria-hidden /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {errors.items && <p className="mt-2 text-[12px] text-danger" role="alert">{errors.items}</p>}

              <div className="mt-5 border-t border-line pt-4">
                <label htmlFor="add-test" className="label">Add a test</label>
                <input id="add-test" type="search" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Filter the catalogue" className="input" />
                <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {catalogLoading && <li className="px-3 py-4 text-[12px] text-muted">Loading catalogue…</li>}
                  {catalog.filter((test) => !catalogQuery || test.name.toLowerCase().includes(catalogQuery.toLowerCase())).slice(0, 40).map((test) => {
                    const added = cart.has('test', test.id)
                    return (
                      <li key={test.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium">{test.name}</span>
                          <span className="text-[11px] text-muted">{formatINR(test.listPricePaise)}{!test.homeCollection ? ' · lab visit only' : ''}</span>
                        </div>
                        <button type="button" onClick={() => cart.toggle({ kind: 'test', id: test.id, name: test.name, pricePaise: test.listPricePaise, homeCollection: test.homeCollection })} className={`btn btn-sm ${added ? 'btn-navy' : 'btn-outline'}`} aria-pressed={added}>{added ? 'Remove' : 'Add'}</button>
                      </li>
                    )
                  })}
                  {!catalogLoading && catalog.length === 0 && <li className="px-3 py-4 text-[12px] text-muted">No published tests yet. <a href="/tests" className="link">Open the catalogue</a></li>}
                </ul>
                <p className="mt-2 text-[11.5px] text-muted">Only published tests can be booked. <a href="/tests" className="link">Open the full catalogue</a></p>
              </div>
            </section>
          )}

          {step === 1 && (
            <section aria-labelledby="step-collection">
              <h2 id="step-collection" className="text-[16px] font-bold">How would you like to give your sample?</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => { setMethod('home'); setErrors({}) }} disabled={!config.collectionEnabled} className={`rounded-xl border p-4 text-left transition ${method === 'home' ? 'border-teal bg-teal-50/60 ring-2 ring-teal/20' : 'border-line hover:border-teal/50'} disabled:opacity-50`} aria-pressed={method === 'home'}>
                  <b className="block text-[13.5px] font-semibold text-navy">Home collection</b>
                  <span className="text-[12px] text-muted">{config.collectionEnabled ? `${config.collectionFeePaise > 0 ? `${formatINR(config.collectionFeePaise)} collection fee · ` : ''}In covered areas of ${config.city}` : 'Currently unavailable'}</span>
                </button>
                <button type="button" onClick={() => { setMethod('lab'); setErrors({}) }} className={`rounded-xl border p-4 text-left transition ${method === 'lab' ? 'border-teal bg-teal-50/60 ring-2 ring-teal/20' : 'border-line hover:border-teal/50'}`} aria-pressed={method === 'lab'}>
                  <b className="block text-[13.5px] font-semibold text-navy">Laboratory visit</b>
                  <span className="text-[12px] text-muted">Visit one of our laboratories at your slot</span>
                </button>
              </div>

              {method === 'home' ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                    <div>
                      <label htmlFor="pincode" className="label">Pincode</label>
                      <input id="pincode" value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="postal-code" className="input" aria-invalid={Boolean(errors.pincode)} placeholder="500034" />
                      {errors.pincode && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.pincode}</p>}
                      {pincode.length === 6 && area && <p className="mt-1 text-[11.5px] font-medium text-success">Covered by {area.name}</p>}
                    </div>
                    <div>
                      <label htmlFor="address" className="label">House / building, street</label>
                      <input id="address" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} autoComplete="street-address" className="input" aria-invalid={Boolean(errors.addressLine)} placeholder="Flat 201, Sri Sai Residency, Road No. 3" />
                      {errors.addressLine && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.addressLine}</p>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="area" className="label">Area / landmark <span className="font-normal text-muted">(optional)</span></label>
                    <input id="area" value={addressArea} onChange={(event) => setAddressArea(event.target.value)} className="input" placeholder="Near metro station" />
                  </div>
                  {relevantAreas.length > 0 && <p className="rounded-lg bg-page p-3 text-[12px] leading-5 text-muted">Service areas: {relevantAreas.map((item) => item.name).join(', ')}.</p>}
                </div>
              ) : (
                <div className="mt-5">
                  <label htmlFor="location" className="label">Laboratory</label>
                  {locations.length === 0 ? (
                    <p className="rounded-lg bg-[#fef3c7] p-3 text-[12.5px] text-[#92400e]">No laboratory locations are configured yet. Please contact us to book.</p>
                  ) : (
                    <select id="location" value={locationId ?? ''} onChange={(event) => setLocationId(Number(event.target.value))} className="input">
                      {locations.map((location) => <option key={location.id} value={location.id}>{location.name} — {location.area || location.addressLine1}</option>)}
                    </select>
                  )}
                  {errors.locationId && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.locationId}</p>}
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="step-slot">
              <h2 id="step-slot" className="text-[16px] font-bold">Choose a date and time</h2>
              <p className="mt-1 text-[12.5px] text-muted">Only slots with capacity remaining are selectable. Your place is held while you finish checkout.</p>
              {availabilityState === 'loading' && <p className="mt-4 flex items-center gap-2 text-[13px] text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Loading availability…</p>}
              {availabilityState === 'error' && <p className="mt-4 text-[13px] text-danger" role="alert">Availability could not be loaded. Please refresh and try again.</p>}
              {availabilityState === 'ready' && days.length === 0 && <p className="mt-4 rounded-lg bg-page p-3 text-[13px] text-muted">No collection slots are configured for this selection{method === 'home' && !area ? ' (enter a covered pincode first)' : ''}. Please call {config.supportPhone || 'the laboratory'}.</p>}
              {days.length > 0 && (
                <>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Appointment date">
                    {days.map((day) => {
                      const open = day.slots.some((slot) => slot.available)
                      return (
                        <button key={day.date} type="button" aria-pressed={date === day.date} onClick={() => { setDate(day.date); setSlotId(null); setErrors({}) }} disabled={!open} className={`shrink-0 rounded-lg border px-3 py-2 text-center text-[12px] transition ${date === day.date ? 'border-teal bg-teal-50 text-teal-700 ring-2 ring-teal/20' : open ? 'border-line bg-white hover:border-teal/50' : 'cursor-not-allowed border-line bg-page text-muted line-through'}`}>
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                  {date && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {daySlots.length === 0 && <p className="text-[12.5px] text-muted">Closed on this date.</p>}
                      {daySlots.map((slot) => (
                        <button key={slot.id} type="button" onClick={() => { setSlotId(slot.id); setErrors({}) }} disabled={!slot.available} aria-pressed={slotId === slot.id} className={`rounded-lg border px-3 py-2.5 text-left text-[13px] transition ${slotId === slot.id ? 'border-teal bg-teal-50 text-teal-700 ring-2 ring-teal/20' : slot.available ? 'border-line bg-white hover:border-teal/50' : 'cursor-not-allowed border-line bg-page text-muted'}`}>
                          <b className="block font-semibold">{slot.label}</b>
                          <span className="text-[11px]">{slot.available ? `${slot.remaining} of ${slot.capacity} left` : 'Full'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {errors.slot && <p className="mt-2 text-[12px] text-danger" role="alert">{errors.slot}</p>}
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="step-patient">
              <h2 id="step-patient" className="text-[16px] font-bold">Patient details</h2>
              <p className="mt-1 text-[12.5px] text-muted">The mobile number is used to verify booking tracking.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="patient-name" className="label">Patient full name</label>
                  <input id="patient-name" value={patient.patientName} onChange={(event) => setPatient({ ...patient, patientName: event.target.value })} autoComplete="name" className="input" aria-invalid={Boolean(errors.patientName)} />
                  {errors.patientName && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.patientName}</p>}
                </div>
                <div>
                  <label htmlFor="patient-age" className="label">Age <span className="font-normal text-muted">(optional)</span></label>
                  <input id="patient-age" value={patient.patientAge} onChange={(event) => setPatient({ ...patient, patientAge: event.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" className="input" />
                </div>
                <div>
                  <label htmlFor="patient-gender" className="label">Gender <span className="font-normal text-muted">(optional)</span></label>
                  <select id="patient-gender" value={patient.patientGender} onChange={(event) => setPatient({ ...patient, patientGender: event.target.value })} className="input">
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="patient-phone" className="label">Mobile number</label>
                  <input id="patient-phone" value={patient.phone} onChange={(event) => setPatient({ ...patient, phone: event.target.value })} inputMode="tel" autoComplete="tel" className="input" aria-invalid={Boolean(errors.phone)} placeholder="98765 43210" />
                  {errors.phone && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.phone}</p>}
                </div>
                <div>
                  <label htmlFor="patient-email" className="label">Email <span className="font-normal text-muted">(optional)</span></label>
                  <input id="patient-email" value={patient.email} onChange={(event) => setPatient({ ...patient, email: event.target.value })} type="email" autoComplete="email" className="input" aria-invalid={Boolean(errors.email)} />
                  {errors.email && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.email}</p>}
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="step-confirm">
              <h2 id="step-confirm" className="text-[16px] font-bold">Review and confirm</h2>
              <dl className="mt-3 divide-y divide-line rounded-lg border border-line text-[13px]">
                <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted">Tests</dt><dd className="text-right font-medium">{cart.items.map((item) => item.name).join(', ')}</dd></div>
                <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted">Collection</dt><dd className="text-right font-medium">{method === 'home' ? `Home · ${addressLine}, ${area?.name ?? ''} ${pincode}` : locations.find((item) => item.id === locationId)?.name}</dd></div>
                <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted">Appointment</dt><dd className="text-right font-medium">{days.find((day) => day.date === date)?.label} · {daySlots.find((slot) => slot.id === slotId)?.label}</dd></div>
                <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted">Patient</dt><dd className="text-right font-medium">{patient.patientName} · {patient.phone}</dd></div>
              </dl>

              <fieldset className="mt-5">
                <legend className="label">Payment method</legend>
                <div className="space-y-2">
                  {([
                    { value: 'online' as const, label: 'Pay online', hint: config.payOnline ? 'Secure payment through Razorpay' : 'Not available', enabled: config.payOnline },
                    { value: 'pay_lab' as const, label: 'Pay at laboratory', hint: 'Pay when you visit', enabled: config.payAtLab && method === 'lab' },
                    { value: 'pay_home' as const, label: 'Pay at collection', hint: 'Pay the collector at your home visit', enabled: config.payAtHome && method === 'home' },
                  ]).filter((option) => option.enabled || option.value === 'online').map((option) => (
                    <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${paymentMethod === option.value ? 'border-teal bg-teal-50/60' : 'border-line'} ${option.enabled ? '' : 'opacity-50'}`}>
                      <input type="radio" name="payment" value={option.value} checked={paymentMethod === option.value} disabled={!option.enabled} onChange={() => setPaymentMethod(option.value)} className="mt-0.5 accent-[#20A99C]" />
                      <span><b className="block text-[13px] font-semibold text-navy">{option.label}</b><span className="text-[11.5px] text-muted">{option.hint}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={`mt-5 flex items-start gap-2.5 rounded-lg border p-3 text-[12.5px] leading-5 ${consent ? 'border-teal/50 bg-teal-50/40' : 'border-line'}`}>
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4 accent-[#20A99C]" aria-invalid={Boolean(errors.consent)} />
                <span>
                  <b className="block font-semibold text-navy">I accept the patient consent and booking terms</b>
                  <span className="text-muted">{config.consentText}</span>{' '}
                  <a href="/terms" className="link" target="_blank" rel="noopener">Booking terms</a>
                </span>
              </label>
              {errors.consent && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.consent}</p>}
              {error && <p className="mt-4 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12.5px] text-danger" role="alert">{error}</p>}
            </section>
          )}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || busy} className="btn btn-outline"><ArrowLeft size={15} aria-hidden /> Back</button>
            <button type="button" onClick={next} disabled={busy || (step === 1 && method === 'lab' && locations.length === 0)} className="btn btn-primary">
              {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Confirming…</> : step === 4 ? <><Lock size={15} aria-hidden /> Confirm booking · {formatINR(previewTotal)}</> : <>Continue <ArrowRight size={15} aria-hidden /></>}
            </button>
          </div>
        </div>

        <aside className="card p-5 lg:sticky lg:top-28">
          <h2 className="text-[14px] font-bold">Booking summary</h2>
          <ul className="mt-3 space-y-2 text-[12.5px]">
            {cart.items.length === 0 && <li className="text-muted">No items yet.</li>}
            {cart.items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-muted">{item.name}</span>
                <span className="shrink-0 tabular-nums">{formatINR(item.pricePaise)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatINR(cart.subtotalPaise)}</dd></div>
            {method === 'home' && <div className="flex justify-between"><dt className="text-muted">Home collection</dt><dd className="tabular-nums">{collectionFee ? formatINR(collectionFee) : 'Included'}</dd></div>}
            <div className="flex justify-between border-t border-line pt-1.5 text-[14px] font-bold text-navy"><dt>Total (preview)</dt><dd className="tabular-nums">{formatINR(previewTotal)}</dd></div>
          </dl>
          <p className="mt-3 text-[11px] leading-5 text-muted">The final amount is recalculated on the server and confirmed on the confirmation page.</p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted"><Lock size={12} aria-hidden /> Payments are processed by Razorpay. We never store card details.</p>
        </aside>
      </div>
    </div>
  )
}
