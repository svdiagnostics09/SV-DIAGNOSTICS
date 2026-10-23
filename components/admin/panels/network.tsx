'use client'

import { useState } from 'react'
import { MapPin, Plus, Trash2, CalendarClock } from 'lucide-react'
import { LocationMap, directionsUrl } from '@/components/admin/location-map'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import { formatINR } from '@/lib/format'
import { Modal } from '@/components/admin/panels/catalogue-support'
import { EmptyState } from '@/components/ui'

type Toast = (text: string, tone?: 'success' | 'error') => void

interface LocationRow { id: number; name: string; addressLine1: string; addressLine2: string; area: string; city: string; state: string; pincode: string; phone: string; email: string; mapsUrl: string; openingHours: string; services: string[]; isActive: boolean }
interface AreaRow { id: number; name: string; city: string; pincodes: string[]; homeCollection: boolean; collectionFeePaise: number; operatingHours: string; isActive: boolean }
interface SlotRow { id: number; locationId: number | null; locationName: string; method: string; label: string; startTime: string; endTime: string; durationMinutes: number; dailyCapacity: number; weekdays: number[]; isActive: boolean }
interface Availability { slots: SlotRow[]; blackouts: Array<{ id: number; date: string; reason: string; slotLabel: string; locationName: string }>; reservations: Array<{ id: string; slot_id: number; date: string; capacity: number; booked: number; holds: number; label: string }> }

export function LocationsPanel({ onToast }: { onToast: Toast }) {
  const locations = useAdminResource<LocationRow[]>('/api/admin/locations?all=1')
  const [draft, setDraft] = useState<Partial<LocationRow> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    const result = await adminFetch(draft.id ? `/api/admin/locations/${draft.id}` : '/api/admin/locations', { method: draft.id ? 'PATCH' : 'POST', body: draft })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setDraft(null); onToast('Location saved.'); locations.reload()
  }

  const toggle = async (row: LocationRow) => {
    const result = await adminFetch(`/api/admin/locations/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(row.isActive ? 'Location hidden from the website.' : 'Location is now active.'); locations.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{locations.data?.length ?? 0} locations · only active locations accept bookings</p>
        <button type="button" onClick={() => { setError(null); setDraft({ name: '', addressLine1: '', addressLine2: '', area: '', city: 'Hyderabad', state: 'Telangana', pincode: '', phone: '', email: '', mapsUrl: '', openingHours: '', services: [], isActive: true }) }} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> Add location</button>
      </div>
      {locations.error && <div className="card p-4 text-[12.5px] text-danger">{locations.error}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {locations.data?.length === 0 && <div className="card md:col-span-2"><EmptyState icon={MapPin} title="No locations configured" description="Add the laboratory's branch details. Until then, laboratory-visit bookings cannot be made." /></div>}
        {locations.data?.map((row) => (
          <article key={row.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-[14px] font-bold">{row.name}</h2>
                <p className="text-[12px] leading-5 text-muted">{row.addressLine1}{row.addressLine2 ? `, ${row.addressLine2}` : ''}{row.area ? `, ${row.area}` : ''} {row.pincode}</p>
                <p className="text-[11.5px] text-muted">{row.phone}{row.phone && row.openingHours ? ' · ' : ''}{row.openingHours}</p>
              </div>
              <span className={`badge ${row.isActive ? 'badge-green' : 'badge-gray'}`}>{row.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setError(null); setDraft(row) }} className="btn btn-outline btn-sm">Edit</button>
              <a href={directionsUrl(row)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Directions</a>
              <button type="button" onClick={() => toggle(row)} className="btn btn-ghost btn-sm">{row.isActive ? 'Deactivate' : 'Activate'}</button>
            </div>
          </article>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/40 p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="mx-auto w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-[15px] font-bold">{draft.id ? 'Edit location' : 'New location'}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="loc-name" className="label">Name</label><input id="loc-name" className="input" value={draft.name ?? ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="loc-a1" className="label">Address line 1</label><input id="loc-a1" className="input" value={draft.addressLine1 ?? ''} onChange={(event) => setDraft({ ...draft, addressLine1: event.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="loc-a2" className="label">Address line 2</label><input id="loc-a2" className="input" value={draft.addressLine2 ?? ''} onChange={(event) => setDraft({ ...draft, addressLine2: event.target.value })} /></div>
              <div><label htmlFor="loc-area" className="label">Area</label><input id="loc-area" className="input" value={draft.area ?? ''} onChange={(event) => setDraft({ ...draft, area: event.target.value })} /></div>
              <div><label htmlFor="loc-pin" className="label">Pincode</label><input id="loc-pin" className="input" value={draft.pincode ?? ''} onChange={(event) => setDraft({ ...draft, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></div>
              <div><label htmlFor="loc-phone" className="label">Phone</label><input id="loc-phone" className="input" value={draft.phone ?? ''} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div>
              <div><label htmlFor="loc-email" className="label">Email</label><input id="loc-email" className="input" value={draft.email ?? ''} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="loc-hours" className="label">Opening hours</label><input id="loc-hours" className="input" value={draft.openingHours ?? ''} onChange={(event) => setDraft({ ...draft, openingHours: event.target.value })} placeholder="Mon–Sat 7:00 AM – 8:00 PM" /></div>
              <div className="sm:col-span-2">
                <label htmlFor="loc-maps" className="label">Directions link (optional)</label>
                <input id="loc-maps" className="input" value={draft.mapsUrl ?? ''} onChange={(event) => setDraft({ ...draft, mapsUrl: event.target.value })} placeholder="https://maps.app.goo.gl/…" />
                <p className="mt-1 text-[11px] text-muted">Paste the Google Maps share link for the exact shop entrance. Directions use it when set, otherwise the address above.</p>
              </div>
              <div className="sm:col-span-2">
                <span className="label">Map preview</span>
                <LocationMap location={{ name: draft.name ?? '', addressLine1: draft.addressLine1, addressLine2: draft.addressLine2, area: draft.area, city: draft.city, pincode: draft.pincode, mapsUrl: draft.mapsUrl }} />
              </div>
              <div className="sm:col-span-2"><label htmlFor="loc-services" className="label">Services (comma separated)</label><input id="loc-services" className="input" value={(draft.services ?? []).join(', ')} onChange={(event) => setDraft({ ...draft, services: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.isActive ?? true} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="size-4 accent-[#20A99C]" /> Active (accepts bookings)</label>
            {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="btn btn-outline btn-sm">Cancel</button>
              <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save location'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ServiceAreasPanel({ onToast }: { onToast: Toast }) {
  const areas = useAdminResource<AreaRow[]>('/api/admin/service-areas?all=1')
  const [draft, setDraft] = useState<(Partial<AreaRow> & { pincodeText?: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    const body = { name: draft.name ?? '', city: draft.city ?? 'Hyderabad', pincodes: (draft.pincodeText ?? (draft.pincodes ?? []).join(', ')).split(/[,\s]+/).filter(Boolean), homeCollection: draft.homeCollection ?? true, collectionFeePaise: draft.collectionFeePaise ?? 0, operatingHours: draft.operatingHours ?? '', isActive: draft.isActive ?? true }
    const result = await adminFetch(draft.id ? `/api/admin/service-areas/${draft.id}` : '/api/admin/service-areas', { method: draft.id ? 'PATCH' : 'POST', body })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setDraft(null); onToast('Service area saved.'); areas.reload()
  }

  const remove = async (row: AreaRow) => {
    if (!window.confirm(`Delete “${row.name}”? Areas used by bookings cannot be deleted.`)) return
    const result = await adminFetch(`/api/admin/service-areas/${row.id}`, { method: 'DELETE' })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast('Service area deleted.'); areas.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{areas.data?.length ?? 0} areas · home collection is offered only where an active area lists the pincode</p>
        <button type="button" onClick={() => { setError(null); setDraft({ name: '', city: 'Hyderabad', pincodes: [], pincodeText: '', homeCollection: true, collectionFeePaise: 0, operatingHours: '', isActive: true }) }} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> Add area</button>
      </div>
      {areas.error && <div className="card p-4 text-[12.5px] text-danger">{areas.error}</div>}
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Area</th><th scope="col" className="px-3 py-2 font-semibold">Pincodes</th><th scope="col" className="px-3 py-2 font-semibold">Hours</th><th scope="col" className="px-3 py-2 font-semibold">Fee</th><th scope="col" className="px-3 py-2 font-semibold">Status</th><th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {areas.data?.length === 0 && <tr><td colSpan={6}><EmptyState icon={MapPin} title="No service areas yet" description="Add Hyderabad areas and their pincodes so customers can book home collection." /></td></tr>}
              {areas.data?.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5"><b className="font-semibold">{row.name}</b><span className="block text-[10.5px] text-muted">{row.city}</span></td>
                  <td className="max-w-[240px] px-3 py-2.5"><span className="line-clamp-2 font-mono text-[11px] text-muted">{row.pincodes.join(', ') || '—'}</span></td>
                  <td className="px-3 py-2.5 text-muted">{row.operatingHours || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatINR(row.collectionFeePaise)}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${row.isActive ? 'badge-green' : 'badge-gray'}`}>{row.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => { setError(null); setDraft({ ...row, pincodeText: row.pincodes.join(', ') }) }} className="btn btn-ghost btn-sm">Edit</button>
                      <button type="button" onClick={() => remove(row)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label={`Delete ${row.name}`}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {draft && (
        <Modal title={draft.id ? 'Edit service area' : 'New service area'} onClose={() => setDraft(null)}>
          <div className="space-y-3">
            <div><label htmlFor="area-name" className="label">Area name</label><input id="area-name" className="input" value={draft.name ?? ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
            <div><label htmlFor="area-city" className="label">City</label><input id="area-city" className="input" value={draft.city ?? ''} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></div>
            <div><label htmlFor="area-pins" className="label">Pincodes (comma separated)</label><input id="area-pins" className="input font-mono" value={draft.pincodeText ?? ''} onChange={(event) => setDraft({ ...draft, pincodeText: event.target.value })} placeholder="500081, 500032" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="area-fee" className="label">Collection fee (₹)</label><input id="area-fee" className="input" value={String((draft.collectionFeePaise ?? 0) / 100)} onChange={(event) => setDraft({ ...draft, collectionFeePaise: Math.round(Number(event.target.value.replace(/[^\d.]/g, '') || 0) * 100) })} /></div>
              <div><label htmlFor="area-hours" className="label">Operating hours</label><input id="area-hours" className="input" value={draft.operatingHours ?? ''} onChange={(event) => setDraft({ ...draft, operatingHours: event.target.value })} /></div>
            </div>
            <div className="flex gap-4 text-[12.5px]">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.homeCollection ?? true} onChange={(event) => setDraft({ ...draft, homeCollection: event.target.checked })} className="size-4 accent-[#20A99C]" /> Home collection</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive ?? true} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="size-4 accent-[#20A99C]" /> Active</label>
            </div>
            {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="btn btn-outline btn-sm">Cancel</button><button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save area'}</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SlotsPanel({ onToast }: { onToast: Toast }) {
  const availability = useAdminResource<Availability>('/api/admin/slots')
  const locations = useAdminResource<LocationRow[]>('/api/admin/locations?all=1')
  const [draft, setDraft] = useState<Partial<SlotRow> | null>(null)
  const [blackout, setBlackout] = useState({ date: '', slotId: '', locationId: '', reason: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    const body = {
      locationId: draft.locationId ? Number(draft.locationId) : null,
      method: draft.method ?? 'both',
      label: draft.label ?? '',
      startTime: draft.startTime ?? '07:00',
      endTime: draft.endTime ?? '08:00',
      durationMinutes: draft.durationMinutes ?? 60,
      dailyCapacity: draft.dailyCapacity ?? 10,
      weekdays: draft.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      isActive: draft.isActive ?? true,
    }
    const result = await adminFetch(draft.id ? `/api/admin/slots/${draft.id}` : '/api/admin/slots', { method: draft.id ? 'PATCH' : 'POST', body })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setDraft(null); onToast('Slot saved.'); availability.reload()
  }

  const addBlackout = async () => {
    setBusy(true); setError(null)
    const result = await adminFetch('/api/admin/slots', { method: 'PUT', body: { date: blackout.date, slotId: blackout.slotId ? Number(blackout.slotId) : null, locationId: blackout.locationId ? Number(blackout.locationId) : null, reason: blackout.reason } })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setBlackout({ date: '', slotId: '', locationId: '', reason: '' }); onToast('Blackout date added.'); availability.reload()
  }

  const removeSlot = async (row: SlotRow) => {
    if (!window.confirm(`Remove slot “${row.label}”? Slots with bookings are deactivated instead.`)) return
    const result = await adminFetch<{ deactivated?: boolean; message?: string }>(`/api/admin/slots/${row.id}`, { method: 'DELETE' })
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(result.data.deactivated ? (result.data.message ?? 'Slot deactivated.') : 'Slot deleted.'); availability.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">Capacity is enforced atomically at booking time — these numbers are the per-day limits</p>
        <button type="button" onClick={() => { setError(null); setDraft({ method: 'both', label: '7:00 – 8:00 AM', startTime: '07:00', endTime: '08:00', durationMinutes: 60, dailyCapacity: 10, weekdays: [1, 2, 3, 4, 5, 6], isActive: true, locationId: null }) }} className="btn btn-primary btn-sm"><Plus size={15} aria-hidden /> Add slot</button>
      </div>
      {availability.error && <div className="card p-4 text-[12.5px] text-danger">{availability.error}</div>}

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Slot</th><th scope="col" className="px-3 py-2 font-semibold">Time</th><th scope="col" className="px-3 py-2 font-semibold">Method</th><th scope="col" className="px-3 py-2 font-semibold">Location</th><th scope="col" className="px-3 py-2 text-right font-semibold">Capacity</th><th scope="col" className="px-3 py-2 font-semibold">Days</th><th scope="col" className="px-3 py-2 font-semibold">Status</th><th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {availability.data?.slots.length === 0 && <tr><td colSpan={8}><EmptyState icon={CalendarClock} title="No collection slots" description="Add slots so customers can choose an appointment time." /></td></tr>}
              {availability.data?.slots.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5 font-semibold">{row.label}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{row.startTime}–{row.endTime}</td>
                  <td className="px-3 py-2.5 capitalize text-muted">{row.method}</td>
                  <td className="px-3 py-2.5 text-muted">{row.locationName}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.dailyCapacity}</td>
                  <td className="px-3 py-2.5 text-[11px] text-muted">{row.weekdays.length === 7 ? 'Every day' : row.weekdays.map((day) => WEEKDAYS[day]).join(' ')}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${row.isActive ? 'badge-green' : 'badge-gray'}`}>{row.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => { setError(null); setDraft(row) }} className="btn btn-ghost btn-sm">Edit</button>
                      <button type="button" onClick={() => removeSlot(row)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fee2e2] hover:text-danger" aria-label={`Remove ${row.label}`}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-[13.5px] font-bold">Holidays &amp; blackout dates</h2>
          <p className="text-[11.5px] text-muted">Bookings are refused server-side for these dates.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div><label htmlFor="bo-date" className="label">Date</label><input id="bo-date" type="date" value={blackout.date} onChange={(event) => setBlackout({ ...blackout, date: event.target.value })} className="input" /></div>
            <div><label htmlFor="bo-reason" className="label">Reason</label><input id="bo-reason" value={blackout.reason} onChange={(event) => setBlackout({ ...blackout, reason: event.target.value })} className="input" placeholder="Public holiday" /></div>
            <div><label htmlFor="bo-slot" className="label">Slot</label><select id="bo-slot" value={blackout.slotId} onChange={(event) => setBlackout({ ...blackout, slotId: event.target.value })} className="input"><option value="">All slots</option>{(availability.data?.slots ?? []).map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}</select></div>
            <div><label htmlFor="bo-location" className="label">Location</label><select id="bo-location" value={blackout.locationId} onChange={(event) => setBlackout({ ...blackout, locationId: event.target.value })} className="input"><option value="">All locations</option>{(locations.data ?? []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
          </div>
          {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
          <button type="button" onClick={addBlackout} disabled={busy || !blackout.date} className="btn btn-primary btn-sm mt-2">Add blackout date</button>
          <ul className="mt-3 divide-y divide-line text-[12px]">
            {availability.data?.blackouts.length === 0 && <li className="py-2 text-muted">None configured.</li>}
            {availability.data?.blackouts.map((row) => <li key={row.id} className="flex justify-between gap-2 py-1.5"><span><b>{row.date}</b> · {row.slotLabel} · {row.locationName}</span><span className="text-muted">{row.reason}</span></li>)}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="text-[13.5px] font-bold">Upcoming reservations</h2>
          <p className="text-[11.5px] text-muted">Booked places vs capacity per slot and date.</p>
          <ul className="mt-2 divide-y divide-line text-[12px]">
            {availability.data?.reservations.length === 0 && <li className="py-2 text-muted">No reservations yet.</li>}
            {availability.data?.reservations.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate">{row.date} · {row.label}</span>
                <span className={`badge ${row.booked + row.holds >= row.capacity ? 'badge-red' : 'badge-gray'}`}>{row.booked}/{row.capacity} booked{row.holds ? ` · ${row.holds} held` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {draft && (
        <Modal title={draft.id ? 'Edit slot' : 'New collection slot'} onClose={() => setDraft(null)}>
          <div className="space-y-3">
            <div><label htmlFor="slot-label" className="label">Label</label><input id="slot-label" className="input" value={draft.label ?? ''} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="slot-start" className="label">Start</label><input id="slot-start" type="time" className="input" value={draft.startTime ?? ''} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></div>
              <div><label htmlFor="slot-end" className="label">End</label><input id="slot-end" type="time" className="input" value={draft.endTime ?? ''} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="slot-method" className="label">Method</label><select id="slot-method" className="input" value={draft.method ?? 'both'} onChange={(event) => setDraft({ ...draft, method: event.target.value })}><option value="both">Home &amp; lab</option><option value="home">Home only</option><option value="lab">Lab only</option></select></div>
              <div><label htmlFor="slot-location" className="label">Location</label><select id="slot-location" className="input" value={draft.locationId ?? ''} onChange={(event) => setDraft({ ...draft, locationId: event.target.value ? Number(event.target.value) : null })}><option value="">All / home</option>{(locations.data ?? []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
              <div><label htmlFor="slot-cap" className="label">Daily capacity</label><input id="slot-cap" className="input" value={draft.dailyCapacity ?? 10} onChange={(event) => setDraft({ ...draft, dailyCapacity: Number(event.target.value.replace(/\D/g, '') || 0) })} /></div>
              <div><label htmlFor="slot-dur" className="label">Duration (min)</label><input id="slot-dur" className="input" value={draft.durationMinutes ?? 60} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value.replace(/\D/g, '') || 60) })} /></div>
            </div>
            <fieldset><legend className="label">Days</legend><div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((day, index) => <label key={day} className={`cursor-pointer rounded-md border px-2 py-1 text-[11.5px] ${(draft.weekdays ?? []).includes(index) ? 'border-teal bg-teal-50 text-teal-700' : 'border-line'}`}><input type="checkbox" className="sr-only" checked={(draft.weekdays ?? []).includes(index)} onChange={(event) => setDraft({ ...draft, weekdays: event.target.checked ? [...(draft.weekdays ?? []), index] : (draft.weekdays ?? []).filter((value) => value !== index) })} />{day}</label>)}</div></fieldset>
            <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={draft.isActive ?? true} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="size-4 accent-[#20A99C]" /> Active</label>
            {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="btn btn-outline btn-sm">Cancel</button><button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save slot'}</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
