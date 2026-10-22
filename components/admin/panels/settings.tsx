'use client'

import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, RotateCcw, Save, ShieldCheck, Upload, UserCog } from 'lucide-react'
import { adminFetch, useAdminResource } from '@/components/admin/fetch'
import type { AdminUser } from '@/lib/auth'

interface SettingsResponse {
  settings: {
    brandName: string; tagline: string; supportPhone: string; supportEmail: string; whatsappNumber: string; address: string
    announcement: string; announcementEnabled: boolean; openingHours: string; aboutText: string; collectionEnabled: boolean
    collectionFeePaise: number; bookingHorizonDays: number; slotHoldMinutes: number; payAtLabEnabled: boolean
    payAtHomeEnabled: boolean; cancellationWindowHours: number; consentVersion: string; patientConsentText: string; bookingTermsText: string
    city: string; state: string; logoUrl: string; faviconUrl: string
    whatsappReportsEnabled: boolean; whatsappTemplateName: string; whatsappTemplateLanguage: string; whatsappTemplateParam: string
  }
  internal: { bookingHorizonDays: number; slotHoldMinutes: number; whatsappConfigured: boolean }
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
    <div className="space-y-4">
      <BrandAssets form={form} onToast={onToast} onChanged={(settings) => setForm((current) => current ? { ...current, ...settings } : current)} />

      <SettingsSection title="Business details" description="Shown on the website footer, contact pages and confirmation emails.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Brand name" id="s-brand" hint="Appears in the header and report footers."><input id="s-brand" className="input" value={form.brandName} onChange={(event) => set('brandName', event.target.value)} /></Field>
          <Field label="Tagline" id="s-tagline"><input id="s-tagline" className="input" value={form.tagline} onChange={(event) => set('tagline', event.target.value)} /></Field>
          <Field label="Opening hours" id="s-hours"><input id="s-hours" className="input" value={form.openingHours} onChange={(event) => set('openingHours', event.target.value)} /></Field>
          <Field label="Support phone" id="s-phone" hint="Used by the call button and confirmation SMS."><input id="s-phone" className="input" inputMode="tel" value={form.supportPhone} onChange={(event) => set('supportPhone', event.target.value)} /></Field>
          <Field label="Support email" id="s-email"><input id="s-email" type="email" className="input" value={form.supportEmail} onChange={(event) => set('supportEmail', event.target.value)} /></Field>
          <Field label="WhatsApp number" id="s-wa"><input id="s-wa" className="input" inputMode="tel" value={form.whatsappNumber} onChange={(event) => set('whatsappNumber', event.target.value)} /></Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Address" id="s-address" hint="Full postal address shown in the footer."><input id="s-address" className="input" value={form.address} onChange={(event) => set('address', event.target.value)} /></Field>
          </div>
          <Field label="City" id="s-city"><input id="s-city" className="input" value={form.city} onChange={(event) => set('city', event.target.value)} /></Field>
          <Field label="State" id="s-state"><input id="s-state" className="input" value={form.state} onChange={(event) => set('state', event.target.value)} /></Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Announcement bar" description="The dark-green strip above the header on every storefront page.">
        <Field label="Message" id="s-announce" hint={`${form.announcement.length}/240 characters`}>
          <input id="s-announce" className="input" value={form.announcement} onChange={(event) => set('announcement', event.target.value)} maxLength={240} />
        </Field>
        <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={form.announcementEnabled} onChange={(event) => set('announcementEnabled', event.target.checked)} className="size-4 accent-[#00B98B]" /> Show the announcement bar</label>
      </SettingsSection>

      <SettingsSection title="About the laboratory" description="Used on the About page and in structured data for search engines.">
        <Field label="About text" id="s-about"><textarea id="s-about" rows={5} className="input" value={form.aboutText} onChange={(event) => set('aboutText', event.target.value)} /></Field>
      </SettingsSection>

      <WhatsappSection form={form} configured={resource.data?.internal.whatsappConfigured ?? false} set={set} />

      <SettingsSection title="Bookings &amp; payments" description="Operational limits. Changing these affects new bookings immediately.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Home collection fee (₹)" id="s-fee"><input id="s-fee" className="input" inputMode="decimal" value={String(form.collectionFeePaise / 100)} onChange={(event) => set('collectionFeePaise', Math.round(Number(event.target.value.replace(/[^\d.]/g, '') || 0) * 100))} /></Field>
          <Field label="Booking horizon (days)" id="s-horizon"><input id="s-horizon" className="input" inputMode="numeric" value={String(form.bookingHorizonDays)} onChange={(event) => set('bookingHorizonDays', Number(event.target.value.replace(/\D/g, '') || 1))} /></Field>
          <Field label="Checkout hold (minutes)" id="s-hold"><input id="s-hold" className="input" inputMode="numeric" value={String(form.slotHoldMinutes)} onChange={(event) => set('slotHoldMinutes', Number(event.target.value.replace(/\D/g, '') || 5))} /></Field>
          <Field label="Cancellation window (hours)" id="s-cancel"><input id="s-cancel" className="input" inputMode="numeric" value={String(form.cancellationWindowHours)} onChange={(event) => set('cancellationWindowHours', Number(event.target.value.replace(/\D/g, '') || 0))} /></Field>
          <Field label="Consent version" id="s-consent"><input id="s-consent" className="input" value={form.consentVersion} onChange={(event) => set('consentVersion', event.target.value)} /></Field>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {([
            ['collectionEnabled', 'Home collection enabled'],
            ['payAtLabEnabled', 'Pay at laboratory'],
            ['payAtHomeEnabled', 'Pay at collection'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] transition hover:bg-surface">
              <input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} className="size-4 accent-[#00B98B]" /> {label}
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Patient consent text" id="s-ptext"><textarea id="s-ptext" rows={4} className="input" value={form.patientConsentText} onChange={(event) => set('patientConsentText', event.target.value)} /></Field>
          <Field label="Booking terms text" id="s-bterms"><textarea id="s-bterms" rows={4} className="input" value={form.bookingTermsText} onChange={(event) => set('bookingTermsText', event.target.value)} /></Field>
        </div>
      </SettingsSection>

      {/* Sticky save bar so the primary action is always reachable on long forms. */}
      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <p className="text-[11.5px] text-muted">Changes go live on the public website as soon as you save.</p>
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary">
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />} Save settings
        </button>
      </div>

      <AccountSection user={user} admins={resource.data?.admins ?? []} onChanged={resource.reload} onToast={onToast} />
    </div>
  )
}

/** How reports reach patients: an administrator opens the chat and sends by hand. */
function WhatsappSection({ form, configured, set }: {
  form: SettingsResponse['settings']
  configured: boolean
  set: <K extends keyof SettingsResponse['settings']>(key: K, value: SettingsResponse['settings'][K]) => void
}) {
  return (
    <SettingsSection title="WhatsApp report delivery" description="Under Patient Reports, “Send on WhatsApp” opens the patient's chat (wa.me) in a new tab. You attach the PDF and press send yourself — nothing is sent automatically.">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#a7e8df] bg-mint-50 px-3 py-2 text-[12px] text-mint-700">
        Manual WhatsApp sending needs no API credentials. The chat opens with the patient's number and a ready-made message; attach the uploaded PDF before sending.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Message greeting" id="s-wa-template" hint="Pre-filled text in the chat. The PDF is attached manually.">
          <input id="s-wa-template" className="input" placeholder="Hello" value={form.whatsappTemplateName} onChange={(event) => set('whatsappTemplateName', event.target.value)} />
        </Field>
        <Field label="Template language" id="s-wa-lang" hint="The code shown in Meta, e.g. en or en_US.">
          <input id="s-wa-lang" className="input" value={form.whatsappTemplateLanguage} onChange={(event) => set('whatsappTemplateLanguage', event.target.value.replace(/[^a-z_]/g, ''))} />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={form.whatsappReportsEnabled} onChange={(event) => set("whatsappReportsEnabled", event.target.checked)} className="size-4 accent-[#00B98B]" /> Allow WhatsApp report sending from the admin panel</label>
    </SettingsSection>
  )
}

/** Logo and favicon upload with live preview and a reset to the built-in mark. */
function BrandAssets({ form, onToast, onChanged }: {
  form: SettingsResponse['settings']
  onToast: (text: string, tone?: 'success' | 'error') => void
  onChanged: (settings: Partial<SettingsResponse['settings']>) => void
}) {
  const [busy, setBusy] = useState<'logo' | 'favicon' | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const faviconInput = useRef<HTMLInputElement>(null)

  const upload = async (kind: 'logo' | 'favicon', file: File | undefined) => {
    if (!file) return
    setBusy(kind)
    const body = new FormData()
    body.append('kind', kind)
    body.append('file', file)
    const result = await adminFetch<{ url: string; settings: Partial<SettingsResponse['settings']> }>('/api/admin/settings/brand', { method: 'POST', formData: body })
    setBusy(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onChanged(result.data.settings)
    onToast(`${kind === 'logo' ? 'Logo' : 'Favicon'} updated — refresh the site to see it.`)
  }

  const reset = async (kind: 'logo' | 'favicon') => {
    setBusy(kind)
    const result = await adminFetch<{ settings: Partial<SettingsResponse['settings']> }>(`/api/admin/settings/brand?kind=${kind}`, { method: 'DELETE' })
    setBusy(null)
    if (!result.ok) { onToast(result.error, 'error'); return }
    onChanged(result.data.settings)
    onToast(`${kind === 'logo' ? 'Logo' : 'Favicon'} reset to the built-in mark.`)
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-line-soft bg-surface px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-[13.5px] font-bold"><ImageIcon size={15} className="text-green" aria-hidden /> Logo &amp; favicon</h2>
        <p className="mt-0.5 text-[11.5px] text-muted">Replace the built-in orange-and-green mark. PNG, JPG, WebP, SVG or ICO up to 1.5 MB.</p>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <AssetTile
          label="Logo" hint="Transparent PNG or SVG, square, bold shapes. Avoid photographs — they vanish at header size." ratio="square" url={form.logoUrl}
          busy={busy === 'logo'} onPick={() => logoInput.current?.click()} onReset={() => reset('logo')}
          resetDisabled={!form.logoUrl}
        />
        <AssetTile
          label="Favicon" hint="Browser tab icon. Square images work best." ratio="wide" url={form.faviconUrl}
          busy={busy === 'favicon'} onPick={() => faviconInput.current?.click()} onReset={() => reset('favicon')}
          resetDisabled={!form.faviconUrl}
        />
      </div>
      <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => { void upload('logo', event.target.files?.[0]); event.target.value = '' }} />
      <input ref={faviconInput} type="file" accept="image/png,image/x-icon,image/svg+xml,image/webp" className="hidden" onChange={(event) => { void upload('favicon', event.target.files?.[0]); event.target.value = '' }} />
    </section>
  )
}

function AssetTile({ label, hint, ratio, url, busy, onPick, onReset, resetDisabled }: {
  label: string; hint: string; ratio: 'square' | 'wide'; url: string; busy: boolean
  onPick: () => void; onReset: () => void; resetDisabled: boolean
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="block text-[12.5px] font-semibold text-forest">{label}</b>
          <span className="text-[11px] text-muted">{hint}</span>
        </div>
        {resetDisabled ? <span className="badge badge-gray shrink-0">Default</span> : <span className="badge badge-teal shrink-0">Custom</span>}
      </div>

      <div className={`mt-2.5 grid place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-surface ${ratio === 'square' ? 'h-24' : 'h-24'}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin previews are user uploads of any size
          <img src={url} alt={`${label} preview`} className={ratio === 'square' ? 'max-h-16 w-auto object-contain' : 'size-12 object-contain'} />
        ) : (
          <span className="text-[11px] text-muted">No custom {label.toLowerCase()}</span>
        )}
      </div>

      {/* Show the asset at the size it is actually used — a photograph that
          looks fine large can disappear at 32px. */}
      {url && (
        <div className="mt-2.5 rounded-lg border border-line-soft bg-surface p-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">At real size</p>
          <div className="mt-1.5 flex items-end gap-3">
            {(ratio === 'square' ? [40, 32] : [32, 16]).map((size) => (
              <span key={size} className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" aria-hidden className="object-contain" style={{ width: size, height: size }} />
                <span className="text-[9.5px] tabular-nums text-muted">{size}px</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5 pl-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" aria-hidden className="size-8 object-contain" />
              <span className="text-[11px] font-bold leading-tight text-forest">SV Diagnostics</span>
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-muted">
            If this is hard to recognise here, use a simpler mark: transparent background, square, bold shapes.
          </p>
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={onPick} disabled={busy} className="btn btn-outline btn-sm flex-1">
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Upload size={13} aria-hidden />} Upload
        </button>
        <button type="button" onClick={onReset} disabled={busy || resetDisabled} className="btn btn-ghost btn-sm" aria-label={`Reset ${label} to default`}>
          <RotateCcw size={13} aria-hidden /> Reset
        </button>
      </div>
    </div>
  )
}

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-line-soft bg-surface px-4 py-3 sm:px-5">
        <h2 className="text-[13.5px] font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
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

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return <div className="min-w-0"><label htmlFor={id} className="label">{label}</label>{children}{hint && <p className="mt-1 text-[11px] leading-4 text-muted">{hint}</p>}</div>
}
