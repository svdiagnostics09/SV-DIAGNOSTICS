'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, ShieldCheck, UserCog } from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import type { AdminUser } from '@/lib/auth'

interface SettingsResponse {
  settings: {
    brandName: string; tagline: string; supportPhone: string; supportEmail: string; whatsappNumber: string; address: string
    announcement: string; announcementEnabled: boolean; openingHours: string; aboutText: string; collectionEnabled: boolean
    collectionFeePaise: number; bookingHorizonDays: number; slotHoldMinutes: number; payOnlineEnabled: boolean; payAtLabEnabled: boolean
    payAtHomeEnabled: boolean; cancellationWindowHours: number; consentVersion: string; patientConsentText: string; bookingTermsText: string
    city: string; state: string
  }
  internal: { bookingHorizonDays: number; slotHoldMinutes: number }
  admins: Array<{ id: string; email: string; name: string; role: string; isActive: boolean; lastLoginAt: string | null }>
}

/** Business settings + owner-only account management. */
export function SettingsPanel({ user, onToast }: { user: AdminUser; onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const resource = useAdminResource<SettingsResponse>('/api/admin/settings')
  const [form, setForm] = useState<SettingsResponse['settings'] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (resource.data && !form) {
      setForm({ ...resource.data.settings, bookingHorizonDays: resource.data.internal.bookingHorizonDays, slotHoldMinutes: resource.data.internal.slotHoldMinutes })
    }
  }, [resource.data, form])

  const save = async () => {
    if (!form) return
    setBusy(true)
    const result = await adminFetch('/api/admin/settings', { method: 'PATCH', body: form })
    setBusy(false)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast('Settings saved — the public website is updated.')
    resource.reload()
  }

  const set = <K extends keyof SettingsResponse['settings']>(key: K, value: SettingsResponse['settings'][K]) => setForm((current) => current ? { ...current, [key]: value } : current)

  if (resource.error) return <div className="card p-4 text-[12.5px] text-danger">{resource.error}</div>
  if (!form) return <div className="card p-6"><Loader2 className="animate-spin text-muted" size={18} aria-hidden /></div>

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <h2 className="text-[14px] font-bold">Website &amp; brand</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Brand name" id="s-brand"><input id="s-brand" className="input" value={form.brandName} onChange={(event) => set('brandName', event.target.value)} /></Field>
          <Field label="Tagline" id="s-tagline"><input id="s-tagline" className="input" value={form.tagline} onChange={(event) => set('tagline', event.target.value)} /></Field>
          <Field label="Support phone" id="s-phone"><input id="s-phone" className="input" value={form.supportPhone} onChange={(event) => set('supportPhone', event.target.value)} /></Field>
          <Field label="Support email" id="s-email"><input id="s-email" type="email" className="input" value={form.supportEmail} onChange={(event) => set('supportEmail', event.target.value)} /></Field>
          <Field label="WhatsApp number" id="s-wa"><input id="s-wa" className="input" value={form.whatsappNumber} onChange={(event) => set('whatsappNumber', event.target.value)} /></Field>
          <Field label="Opening hours" id="s-hours"><input id="s-hours" className="input" value={form.openingHours} onChange={(event) => set('openingHours', event.target.value)} /></Field>
          <Field label="Address" id="s-address"><input id="s-address" className="input" value={form.address} onChange={(event) => set('address', event.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" id="s-city"><input id="s-city" className="input" value={form.city} onChange={(event) => set('city', event.target.value)} /></Field>
            <Field label="State" id="s-state"><input id="s-state" className="input" value={form.state} onChange={(event) => set('state', event.target.value)} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Announcement bar" id="s-announce"><input id="s-announce" className="input" value={form.announcement} onChange={(event) => set('announcement', event.target.value)} maxLength={240} /></Field>
            <label className="mt-2 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={form.announcementEnabled} onChange={(event) => set('announcementEnabled', event.target.checked)} className="size-4 accent-[#20A99C]" /> Show announcement bar</label>
          </div>
          <div className="sm:col-span-2">
            <Field label="About text" id="s-about"><textarea id="s-about" rows={4} className="input" value={form.aboutText} onChange={(event) => set('aboutText', event.target.value)} /></Field>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-[14px] font-bold">Bookings &amp; payments</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Home collection fee (₹)" id="s-fee"><input id="s-fee" className="input" value={String(form.collectionFeePaise / 100)} onChange={(event) => set('collectionFeePaise', Math.round(Number(event.target.value.replace(/[^\d.]/g, '') || 0) * 100))} /></Field>
          <Field label="Booking horizon (days)" id="s-horizon"><input id="s-horizon" className="input" value={String(form.bookingHorizonDays)} onChange={(event) => set('bookingHorizonDays', Number(event.target.value.replace(/\D/g, '') || 1))} /></Field>
          <Field label="Checkout hold (minutes)" id="s-hold"><input id="s-hold" className="input" value={String(form.slotHoldMinutes)} onChange={(event) => set('slotHoldMinutes', Number(event.target.value.replace(/\D/g, '') || 5))} /></Field>
          <Field label="Cancellation window (hours)" id="s-cancel"><input id="s-cancel" className="input" value={String(form.cancellationWindowHours)} onChange={(event) => set('cancellationWindowHours', Number(event.target.value.replace(/\D/g, '') || 0))} /></Field>
          <Field label="Consent version" id="s-consent"><input id="s-consent" className="input" value={form.consentVersion} onChange={(event) => set('consentVersion', event.target.value)} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12.5px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.collectionEnabled} onChange={(event) => set('collectionEnabled', event.target.checked)} className="size-4 accent-[#20A99C]" /> Home collection enabled</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.payOnlineEnabled} onChange={(event) => set('payOnlineEnabled', event.target.checked)} className="size-4 accent-[#20A99C]" /> Online payment</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.payAtLabEnabled} onChange={(event) => set('payAtLabEnabled', event.target.checked)} className="size-4 accent-[#20A99C]" /> Pay at laboratory</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.payAtHomeEnabled} onChange={(event) => set('payAtHomeEnabled', event.target.checked)} className="size-4 accent-[#20A99C]" /> Pay at collection</label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Patient consent text" id="s-ptext"><textarea id="s-ptext" rows={3} className="input" value={form.patientConsentText} onChange={(event) => set('patientConsentText', event.target.value)} /></Field>
          <Field label="Booking terms text" id="s-bterms"><textarea id="s-bterms" rows={3} className="input" value={form.bookingTermsText} onChange={(event) => set('bookingTermsText', event.target.value)} /></Field>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary">{busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />} Save settings</button>
      </div>

      <AccountSection user={user} admins={resource.data?.admins ?? []} onChanged={resource.reload} onToast={onToast} />
    </div>
  )
}

function AccountSection({ user, admins, onChanged, onToast }: { user: AdminUser; admins: SettingsResponse['admins']; onChanged: () => void; onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const [profile, setProfile] = useState({ name: user.name, email: user.email })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [newAdmin, setNewAdmin] = useState({ email: '', name: '', password: '', role: 'admin' as 'admin' | 'owner' })
  const [busy, setBusy] = useState<string | null>(null)

  const put = async (body: Record<string, unknown>, message: string, key: string, reset?: () => void) => {
    setBusy(key)
    const result = await adminFetch('/api/admin/settings', { method: 'PUT', body })
    setBusy(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onToast(message); reset?.(); onChanged()
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="card p-4">
        <h2 className="flex items-center gap-2 text-[14px] font-bold"><ShieldCheck size={15} className="text-teal-700" aria-hidden /> Your account</h2>
        <div className="mt-3 space-y-3">
          <Field label="Display name" id="acc-name"><input id="acc-name" className="input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
          <Field label="Email / username" id="acc-email"><input id="acc-email" className="input" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></Field>
          <button type="button" onClick={() => put({ action: 'profile', ...profile }, 'Profile updated.', 'profile')} disabled={busy === 'profile'} className="btn btn-outline btn-sm">Save profile</button>
          <div className="border-t border-line pt-3" />
          <Field label="Current password" id="acc-current"><input id="acc-current" type="password" autoComplete="current-password" className="input" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></Field>
          <Field label="New password (10+ characters)" id="acc-new"><input id="acc-new" type="password" autoComplete="new-password" className="input" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></Field>
          <button type="button" onClick={() => put({ action: 'password', ...passwords }, 'Password changed. All sessions were signed out.', 'password', () => { setPasswords({ currentPassword: '', newPassword: '' }); setTimeout(() => window.location.assign('/admin/login'), 800) })} disabled={busy === 'password'} className="btn btn-outline btn-sm">Change password</button>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="flex items-center gap-2 text-[14px] font-bold"><UserCog size={15} className="text-teal-700" aria-hidden /> Administrators {user.role !== 'owner' && <span className="badge badge-gray">owner only</span>}</h2>
        <ul className="mt-2 divide-y divide-line text-[12.5px]">
          {admins.map((admin) => (
            <li key={admin.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0"><b className="block truncate">{admin.name || admin.email}</b><span className="text-[10.5px] text-muted">{admin.email} · {admin.role}{admin.lastLoginAt ? ` · last seen ${new Date(admin.lastLoginAt).toLocaleDateString('en-IN')}` : ''}</span></div>
              <div className="flex items-center gap-1.5">
                <span className={`badge ${admin.isActive ? 'badge-green' : 'badge-gray'}`}>{admin.isActive ? 'active' : 'disabled'}</span>
                {user.role === 'owner' && admin.id !== user.id && (
                  <button type="button" onClick={() => put({ action: 'toggle_admin', userId: admin.id, isActive: !admin.isActive }, admin.isActive ? 'Administrator disabled.' : 'Administrator enabled.', `toggle-${admin.id}`)} className="btn btn-ghost btn-sm">{admin.isActive ? 'Disable' : 'Enable'}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {user.role === 'owner' && (
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            <p className="text-[11.5px] text-muted">Create another administrator. There is no public registration.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" placeholder="Name" value={newAdmin.name} onChange={(event) => setNewAdmin({ ...newAdmin, name: event.target.value })} aria-label="New admin name" />
              <input className="input" placeholder="Email" value={newAdmin.email} onChange={(event) => setNewAdmin({ ...newAdmin, email: event.target.value })} aria-label="New admin email" />
              <input className="input" type="password" placeholder="Temporary password" autoComplete="new-password" value={newAdmin.password} onChange={(event) => setNewAdmin({ ...newAdmin, password: event.target.value })} aria-label="New admin password" />
              <select className="input" value={newAdmin.role} onChange={(event) => setNewAdmin({ ...newAdmin, role: event.target.value as 'admin' | 'owner' })} aria-label="Role"><option value="admin">Admin</option><option value="owner">Owner</option></select>
            </div>
            <button type="button" onClick={() => put({ action: 'create_admin', ...newAdmin }, 'Administrator created.', 'create-admin', () => setNewAdmin({ email: '', name: '', password: '', role: 'admin' }))} disabled={busy === 'create-admin'} className="btn btn-primary btn-sm">Create administrator</button>
          </div>
        )}
      </div>
    </section>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="label">{label}</label>{children}</div>
}
