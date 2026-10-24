'use client'

import { useEffect, useRef, useState } from 'react'
import { UseMyLocation } from '@/components/booking/use-my-location'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Clock3, FlaskConical, Home, Loader2, Lock, MapPin, Search as SearchIcon, ShoppingBag, Store, Trash2 } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import type { TestView, PackageView } from '@/lib/catalogue'
import type { LocationView, ServiceAreaView } from '@/lib/network'
import type { BookingConfigShape } from '@/lib/booking-config'
import { formatINR } from '@/lib/format'

interface AvailabilityDay { date: string; label: string; weekday: number; slots: Array<{ id: number; label: string; startTime: string; remaining: number; capacity: number; available: boolean }> }

type PaymentMethod = 'pay_lab' | 'pay_home'

const STEPS = ['Tests', 'Collection', 'Slot', 'Patient', 'Confirm'] as const

/**
 * Five-step booking flow. The summary is a preview; the server recalculates
 * every amount (and re-checks capacity) when the booking is created.
 */
export function BookingWizard({ config, locations, areas }: { config: BookingConfigShape; locations: LocationView[]; areas: ServiceAreaView[] }) {
  const searchParams = useSearchParams()
  const presetTestId = Number(searchParams.get('test') ?? '')
  const presetPackageId = Number(searchParams.get('package') ?? '')
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(config.payAtLab ? 'pay_lab' : 'pay_home')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [catalog, setCatalog] = useState<TestView[]>([])
  const [packages, setPackages] = useState<PackageView[]>([])
  const presetsApplied = useRef(false)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)

  const area = areas.find((item) => item.homeCollection && item.pincodes.includes(pincode.trim()))
  const collectionFee = method === 'home' ? config.collectionFeePaise : 0
  const previewTotal = cart.subtotalPaise + collectionFee

  // One catalogue request serves both the step-1 list and any ?test=/?package=
  // preselection, so opening /book never triggers three separate fetches.
  useEffect(() => {
    if (catalog.length > 0) return
    const controller = new AbortController()
    fetch('/api/catalogue?pageSize=48', { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        setCatalog(body.tests ?? [])
        setPackages(body.packages ?? [])
        setCatalogLoading(false)
      })
      .catch((error) => { if ((error as Error).name !== 'AbortError') setCatalogLoading(false) })
    return () => controller.abort()
  }, [catalog.length])

  // A test or package chosen from its detail page is added to the booking as
  // soon as the catalogue above has loaded.
  useEffect(() => {
    if (!cart.ready || presetsApplied.current) return
    const test = Number.isInteger(presetTestId) && presetTestId > 0 ? catalog.find((item) => item.id === presetTestId) : undefined
    const pack = Number.isInteger(presetPackageId) && presetPackageId > 0 ? packages.find((item) => item.id === presetPackageId) : undefined
    if (test && !cart.has('test', test.id)) {
      cart.add({ kind: 'test', id: test.id, name: test.name, pricePaise: test.pricePaise, listPricePaise: test.listPricePaise, homeCollection: test.homeCollection })
    }
    if (pack && !cart.has('package', pack.id)) {
      cart.add({ kind: 'package', id: pack.id, name: pack.name, pricePaise: pack.pricePaise, listPricePaise: pack.originalPricePaise ?? pack.pricePaise, homeCollection: pack.homeCollection })
    }
    // Run once per catalogue load: `cart` changes identity on every update.
    if ((presetTestId > 0 && test) || (presetPackageId > 0 && pack) || (!presetTestId && !presetPackageId)) presetsApplied.current = true
  }, [presetTestId, presetPackageId, catalog, packages, cart])

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

    cart.clear()
    window.location.assign(body.confirmationUrl)
  }

  // Keep the chosen method valid when the collection method changes: pay at
  // laboratory only exists for lab visits, pay at collection only for home.
  useEffect(() => {
    if (paymentMethod === 'pay_lab' && (method !== 'lab' || !config.payAtLab)) {
      if (config.payAtHome && method === 'home') setPaymentMethod('pay_home')
    } else if (paymentMethod === 'pay_home' && (method !== 'home' || !config.payAtHome)) {
      if (config.payAtLab && method === 'lab') setPaymentMethod('pay_lab')
    }
  }, [method, paymentMethod, config.payAtLab, config.payAtHome])

  const relevantAreas = areas.filter((item) => item.homeCollection)
  const filteredCatalog = catalog
    .filter((test) => !catalogQuery || test.name.toLowerCase().includes(catalogQuery.toLowerCase()))
    .slice(0, 40)
  const stepLabel = STEPS[step]
  const collectionLabel = method === 'home'
    ? (area ? `Home · ${area.name}` : 'Home collection')
    : (locations.find((item) => item.id === locationId)?.name ?? 'Laboratory visit')

  return (
    <div className="page-wide motion-rise py-5 sm:py-7">
      {/* Page header + progress rail */}
      <header className="soft-grid rounded-card border border-line bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.4rem] font-bold leading-tight tracking-[-0.02em] sm:text-[1.75rem]">Book your test</h1>
            <p className="mt-0.5 text-[12.5px] text-muted">Prices, availability and totals are verified on our server.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-mint-50 px-3 py-1.5 text-[11.5px] font-semibold text-mint-700">
            <Lock size={12} aria-hidden /> Secure checkout
          </div>
        </div>

        <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Booking steps">
          {STEPS.map((label, index) => {
            const done = index < step
            const active = index === step
            return (
              <li key={label} className="min-w-0">
                <div className={`h-1 rounded-full ${done || active ? 'bg-mint' : 'bg-line'}`} />
                <div className="mt-2 flex items-center gap-1.5">
                  <span aria-current={active ? 'step' : undefined} className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${done ? 'bg-mint text-white' : active ? 'bg-forest text-white' : 'bg-line-soft text-muted'}`}>
                    {done ? <Check size={11} aria-hidden /> : index + 1}
                  </span>
                  <span className={`truncate text-[11.5px] ${active ? 'font-bold text-forest' : done ? 'font-medium text-ink' : 'text-muted'}`}>{label}</span>
                </div>
              </li>
            )
          })}
        </ol>
      </header>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 card overflow-hidden p-0">
          <div className="border-b border-line-soft bg-surface px-4 py-3 sm:px-6">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Step {step + 1} of {STEPS.length}</p>
            <h2 className="mt-0.5 text-[15px] font-bold text-forest sm:text-[16.5px]">
              {step === 0 && 'Your tests and packages'}
              {step === 1 && 'How would you like to give your sample?'}
              {step === 2 && 'Choose a date and time'}
              {step === 3 && 'Patient details'}
              {step === 4 && 'Review and confirm'}
            </h2>
          </div>
          <div className="p-4 sm:p-6">
          {step === 0 && (
            <section aria-labelledby="step-tests">
              <h3 id="step-tests" className="sr-only">Your tests and packages</h3>
              {cart.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center">
                  <ShoppingBag size={24} className="mx-auto text-muted" aria-hidden />
                  <p className="mt-2 text-[13.5px] font-semibold">Your booking is empty</p>
                  <p className="mt-1 text-[12.5px] text-muted">Add a test from the catalogue below to get started.</p>
                </div>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {cart.items.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-line bg-white p-3">
                      <div className="min-w-0">
                        <b className="block truncate text-[13px] font-semibold text-forest">{item.name}</b>
                        <span className="text-[11px] capitalize text-muted">{item.kind === 'package' ? 'Health package' : 'Lab test'}{item.homeCollection ? ' · home collection' : ' · lab visit only'}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[13px] font-semibold tabular-nums">{formatINR(item.pricePaise)}</span>
                        <button type="button" onClick={() => { cart.remove(item.kind, item.id); setErrors({}) }} className="grid size-7 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-danger" aria-label={`Remove ${item.name}`}><Trash2 size={13} aria-hidden /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {errors.items && <p className="mt-2 text-[12px] text-danger" role="alert">{errors.items}</p>}

              <div className="mt-5 rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="add-test" className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Add a test</label>
                  <span className="text-[11px] text-muted">{catalog.length} published</span>
                </div>
                <div className="relative mt-2">
                  <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                  <input id="add-test" type="search" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search by test or package name" className="input pl-9" />
                </div>

                <div className="mt-2 max-h-[340px] overflow-y-auto pr-1">
                  {catalogLoading && <p className="py-6 text-center text-[12px] text-muted">Loading catalogue…</p>}
                  {!catalogLoading && catalog.length === 0 && (
                    <p className="py-6 text-center text-[12px] text-muted">No published tests yet. <a href="/tests" className="link">Open the catalogue</a></p>
                  )}
                  {!catalogLoading && catalog.length > 0 && filteredCatalog.length === 0 && (
                    <p className="py-6 text-center text-[12px] text-muted">Nothing matches “{catalogQuery}”.</p>
                  )}
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {filteredCatalog.map((test) => {
                      const added = cart.has('test', test.id)
                      return (
                        <li key={test.id} className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition ${added ? 'border-mint bg-mint-50/70' : 'border-line hover:border-green/40 hover:bg-surface'}`}>
                          <div className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium text-ink">{test.name}</span>
                            <span className="text-[11px] text-muted">{formatINR(test.listPricePaise)}{!test.homeCollection ? ' · lab only' : ''}</span>
                          </div>
                          <button type="button" onClick={() => cart.toggle({ kind: 'test', id: test.id, name: test.name, pricePaise: test.listPricePaise, homeCollection: test.homeCollection })} className={`btn btn-sm shrink-0 ${added ? 'btn-navy' : 'btn-outline'}`} aria-pressed={added}>{added ? <><Check size={12} aria-hidden /> Added</> : 'Add'}</button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <p className="mt-2 text-[11.5px] text-muted">Only published tests can be booked. <a href="/tests" className="link">Open the full catalogue</a></p>
              </div>
            </section>
          )}

          {step === 1 && (
            <section aria-labelledby="step-collection">
              <h3 id="step-collection" className="sr-only">Collection method</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => { setMethod('home'); setErrors({}) }} disabled={!config.collectionEnabled} className={`flex min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition ${method === 'home' ? 'border-mint bg-mint-50/70 ring-2 ring-mint/25' : 'border-line hover:border-green/40'} disabled:opacity-50`} aria-pressed={method === 'home'}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${method === 'home' ? 'bg-mint text-white' : 'bg-line-soft text-muted'}`}><Home size={16} aria-hidden /></span>
                  <span className="min-w-0">
                    <b className="block text-[13.5px] font-semibold text-forest">Home collection</b>
                    <span className="mt-0.5 block text-[12px] leading-5 text-muted">{config.collectionEnabled ? `${config.collectionFeePaise > 0 ? `${formatINR(config.collectionFeePaise)} collection fee · ` : 'No collection fee · '}In covered areas of ${config.city}` : 'Currently unavailable'}</span>
                  </span>
                </button>
                <button type="button" onClick={() => { setMethod('lab'); setErrors({}) }} className={`flex min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition ${method === 'lab' ? 'border-mint bg-mint-50/70 ring-2 ring-mint/25' : 'border-line hover:border-green/40'}`} aria-pressed={method === 'lab'}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${method === 'lab' ? 'bg-mint text-white' : 'bg-line-soft text-muted'}`}><Store size={16} aria-hidden /></span>
                  <span className="min-w-0">
                    <b className="block text-[13.5px] font-semibold text-forest">Laboratory visit</b>
                    <span className="mt-0.5 block text-[12px] leading-5 text-muted">Visit one of our laboratories at your chosen slot</span>
                  </span>
                </button>
              </div>

              {method === 'home' ? (
                <div className="mt-5 rounded-xl border border-line p-4">
                  <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      <label htmlFor="pincode" className="label">Pincode</label>
                      <input id="pincode" value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="postal-code" className="input" aria-invalid={Boolean(errors.pincode)} placeholder="500034" />
                      {errors.pincode && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.pincode}</p>}
                      {pincode.length === 6 && area && <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-success"><Check size={12} aria-hidden /> Covered by {area.name}</p>}
                      <div className="mt-2">
                        <UseMyLocation
                          onLocated={(found) => {
                            if (found.pincode) setPincode(found.pincode)
                            if (found.addressLine) setAddressLine(found.addressLine)
                            if (found.area) setAddressArea(found.area)
                          }}
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="address" className="label">House / building, street</label>
                      <input id="address" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} autoComplete="street-address" className="input" aria-invalid={Boolean(errors.addressLine)} placeholder="Flat 201, Sri Sai Residency, Road No. 3" />
                      {errors.addressLine && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.addressLine}</p>}
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="area" className="label">Area / landmark <span className="font-normal text-muted">(optional)</span></label>
                    <input id="area" value={addressArea} onChange={(event) => setAddressArea(event.target.value)} className="input" placeholder="Near metro station" />
                  </div>
                  {relevantAreas.length > 0 && (
                    <div className="mt-4 rounded-lg bg-surface p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"><MapPin size={12} aria-hidden /> Service areas</p>
                      <p className="mt-1 text-[12px] leading-5 text-muted">{relevantAreas.map((item) => item.name).join(', ')}.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-line p-4">
                  <label htmlFor="location" className="label">Laboratory</label>
                  {locations.length === 0 ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-[12.5px] text-[#92400e]">No laboratory locations are configured yet. Please contact us to book.</p>
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
              <h3 id="step-slot" className="sr-only">Choose a date and time</h3>
              <p className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-[12px] leading-5 text-muted">
                <Clock3 size={13} className="mt-0.5 shrink-0 text-green" aria-hidden /> Only slots with capacity remaining are selectable. Your place is held while you finish checkout.
              </p>
              {availabilityState === 'loading' && <p className="mt-4 flex items-center gap-2 text-[13px] text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Loading availability…</p>}
              {availabilityState === 'error' && <p className="mt-4 text-[13px] text-danger" role="alert">Availability could not be loaded. Please refresh and try again.</p>}
              {availabilityState === 'ready' && days.length === 0 && <p className="mt-4 rounded-lg bg-surface p-3 text-[13px] text-muted">No collection slots are configured for this selection{method === 'home' && !area ? ' (enter a covered pincode first)' : ''}. Please call {config.supportPhone || 'the laboratory'}.</p>}
              {days.length > 0 && (
                <>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Date</p>
                  <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Appointment date">
                    {days.map((day) => {
                      const open = day.slots.some((slot) => slot.available)
                      const selected = date === day.date
                      return (
                        <button key={day.date} type="button" aria-pressed={selected} onClick={() => { setDate(day.date); setSlotId(null); setErrors({}) }} disabled={!open} className={`w-[86px] shrink-0 rounded-xl border px-2 py-2.5 text-center transition ${selected ? 'border-mint bg-mint-50 text-mint-700 ring-2 ring-mint/25' : open ? 'border-line bg-white hover:border-green/40' : 'cursor-not-allowed border-line bg-surface text-muted line-through'}`}>
                          <span className="block text-[11.5px] font-semibold">{day.label}</span>
                          <span className="mt-0.5 block text-[10.5px] text-muted">{open ? `${day.slots.filter((slot) => slot.available).length} open` : 'Full'}</span>
                        </button>
                      )
                    })}
                  </div>
                  {date && (
                    <>
                      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Time</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {daySlots.length === 0 && <p className="text-[12.5px] text-muted">Closed on this date.</p>}
                        {daySlots.map((slot) => {
                          const selected = slotId === slot.id
                          return (
                            <button key={slot.id} type="button" onClick={() => { setSlotId(slot.id); setErrors({}) }} disabled={!slot.available} aria-pressed={selected} className={`rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-mint bg-mint-50 text-mint-700 ring-2 ring-mint/25' : slot.available ? 'border-line bg-white hover:border-green/40' : 'cursor-not-allowed border-line bg-surface text-muted'}`}>
                              <b className="block text-[12.5px] font-semibold">{slot.label}</b>
                              <span className="text-[11px]">{slot.available ? `${slot.remaining} of ${slot.capacity} left` : 'Full'}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
              {errors.slot && <p className="mt-2 text-[12px] text-danger" role="alert">{errors.slot}</p>}
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="step-patient">
              <h3 id="step-patient" className="sr-only">Patient details</h3>
              <p className="mb-4 text-[12px] text-muted">The mobile number is used to verify booking tracking.</p>
              <div className="grid gap-4 sm:grid-cols-2">
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
              <h3 id="step-confirm" className="sr-only">Review and confirm</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Tests', cart.items.map((item) => item.name).join(', ')],
                  ['Collection', method === 'home' ? `Home · ${area?.name ?? ''} ${pincode}` : (locations.find((item) => item.id === locationId)?.name ?? '—')],
                  ['Address', method === 'home' ? `${addressLine}${addressArea ? `, ${addressArea}` : ''}` : 'Laboratory visit'],
                  ['Appointment', `${days.find((day) => day.date === date)?.label ?? '—'} · ${daySlots.find((slot) => slot.id === slotId)?.label ?? '—'}`],
                  ['Patient', `${patient.patientName}${patient.patientAge ? ` · ${patient.patientAge} yrs` : ''}`],
                  ['Mobile', patient.phone],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-line bg-surface px-3 py-2">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
                    <dd className="mt-0.5 break-words text-[12.5px] font-medium text-ink">{value || '—'}</dd>
                  </div>
                ))}
              </dl>

              <fieldset className="mt-5">
                <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Payment method</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    { value: 'pay_lab' as const, label: 'Pay at laboratory', hint: 'Pay when you visit', enabled: config.payAtLab && method === 'lab' },
                    { value: 'pay_home' as const, label: 'Pay at collection', hint: 'Pay the collector at home', enabled: config.payAtHome && method === 'home' },
                  ]).filter((option) => option.enabled).map((option) => (
                    <label key={option.value} className={`flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${paymentMethod === option.value ? 'border-mint bg-mint-50/70' : 'border-line hover:border-green/40'} ${option.enabled ? '' : 'opacity-50'}`}>
                      <input type="radio" name="payment" value={option.value} checked={paymentMethod === option.value} disabled={!option.enabled} onChange={() => setPaymentMethod(option.value)} className="mt-0.5 accent-[#00B98B]" />
                      <span className="min-w-0"><b className="block text-[12.5px] font-semibold text-forest">{option.label}</b><span className="block text-[11px] leading-4 text-muted">{option.hint}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-[12.5px] leading-5 ${consent ? 'border-mint/60 bg-mint-50/40' : 'border-line'}`}>
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#00B98B]" aria-invalid={Boolean(errors.consent)} />
                <span className="min-w-0">
                  <b className="block font-semibold text-forest">I accept the patient consent and booking terms</b>
                  <span className="text-muted">{config.consentText}</span>{' '}
                  <a href="/terms" className="link" target="_blank" rel="noopener">Booking terms</a>
                </span>
              </label>
              {errors.consent && <p className="mt-1 text-[11.5px] text-danger" role="alert">{errors.consent}</p>}
              {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-danger" role="alert">{error}</p>}
            </section>
          )}

          <div className="mt-6 hidden items-center justify-between gap-2 border-t border-line pt-4 sm:flex">
            <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || busy} className="btn btn-outline"><ArrowLeft size={15} aria-hidden /> Back</button>
            <button type="button" onClick={next} disabled={busy || (step === 1 && method === 'lab' && locations.length === 0)} className="btn btn-primary">
              {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Confirming…</> : step === 4 ? <><Lock size={15} aria-hidden /> Confirm booking · {formatINR(previewTotal)}</> : <>Continue <ArrowRight size={15} aria-hidden /></>}
            </button>
          </div>
          </div>
        </div>

        <aside className="min-w-0 card p-0 lg:sticky lg:top-24">
          <div className="border-b border-line-soft px-4 py-3">
            <h2 className="text-[13.5px] font-bold text-forest">Booking summary</h2>
            <p className="mt-0.5 text-[11px] text-muted">{cart.count === 0 ? 'No items yet' : `${cart.count} item${cart.count === 1 ? '' : 's'} selected`}</p>
          </div>

          <div className="px-4 py-3">
            <ul className="space-y-2 text-[12.5px]">
              {cart.items.length === 0 && <li className="rounded-lg bg-surface px-3 py-3 text-center text-muted">Add a test to see the summary.</li>}
              {cart.items.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 break-words text-muted">{item.name}</span>
                  <span className="shrink-0 tabular-nums">{formatINR(item.pricePaise)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1.5 border-t border-line-soft pt-3 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatINR(cart.subtotalPaise)}</dd></div>
              {method === 'home' && <div className="flex justify-between"><dt className="text-muted">Home collection</dt><dd className="tabular-nums">{collectionFee ? formatINR(collectionFee) : 'Included'}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold text-forest"><dt>Total (preview)</dt><dd className="tabular-nums">{formatINR(previewTotal)}</dd></div>
            </dl>
          </div>

          <div className="space-y-2 border-t border-line-soft bg-surface px-4 py-3">
            <ul className="space-y-2 text-[11.5px]">
              <li className="flex items-center gap-2 text-muted"><Store size={13} className="shrink-0 text-green" aria-hidden /><span className="truncate">{collectionLabel}</span></li>
              <li className="flex items-center gap-2 text-muted"><Clock3 size={13} className="shrink-0 text-green" aria-hidden /><span className="truncate">{date ? `${days.find((day) => day.date === date)?.label ?? ''} · ${daySlots.find((slot) => slot.id === slotId)?.label ?? 'Pick a time'}` : 'Slot not chosen yet'}</span></li>
              <li className="flex items-center gap-2 text-muted"><FlaskConical size={13} className="shrink-0 text-green" aria-hidden /><span className="truncate">{cart.items.length} test{cart.items.length === 1 ? '' : 's'} · final amount verified on server</span></li>
            </ul>
            <p className="flex items-start gap-1.5 pt-1 text-[10.5px] leading-4 text-muted"><Lock size={11} className="mt-0.5 shrink-0" aria-hidden /> No card details are collected online. Pay the collector or at the laboratory.</p>
          </div>
        </aside>
      </div>

      {/* Mobile action bar — keeps Continue reachable without scrolling. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-xl sm:hidden">
        <div className="flex items-center gap-2">
          {step > 0 && <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={busy} className="btn btn-outline shrink-0" aria-label="Back"><ArrowLeft size={15} aria-hidden /></button>}
          <button type="button" onClick={next} disabled={busy || (step === 1 && method === 'lab' && locations.length === 0)} className="btn btn-primary min-w-0 flex-1">
            {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Confirming…</> : step === 4 ? `Confirm · ${formatINR(previewTotal)}` : <>Continue <ArrowRight size={15} aria-hidden /></>}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-muted">{stepLabel} · step {step + 1} of {STEPS.length} · {formatINR(previewTotal)}</p>
      </div>
    </div>
  )
}
