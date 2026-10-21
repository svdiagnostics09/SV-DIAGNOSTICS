import Link from 'next/link'
import { Apple, Play, Mail, MapPin, Phone, Clock3 } from 'lucide-react'
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/storefront/content'
import { Logo } from '@/components/storefront/logo'
import type { PublicSettings } from '@/lib/settings'

function SocialIcon({ label, path }: { label: string; path: string }) {
  return (
    <Link
      href="/contact"
      aria-label={`${label} — ask us for our ${label} page`}
      className="grid size-9 place-items-center rounded-full border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
      title="Social profile not configured — contact us for details"
    >
      <svg viewBox="0 0 24 24" className="size-[15px]" fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
    </Link>
  )
}

const SOCIALS = [
  { label: 'Facebook', path: 'M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v6h3v-6h2.5l.5-3H13v-2c0-.6.4-1 1-1Z' },
  { label: 'Instagram', path: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 5.7a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4ZM16.3 6h-8.6A1.7 1.7 0 0 0 6 7.7v8.6A1.7 1.7 0 0 0 7.7 18h8.6a1.7 1.7 0 0 0 1.7-1.7V7.7A1.7 1.7 0 0 0 16.3 6Zm.5 10.3a.5.5 0 0 1-.5.5H7.7a.5.5 0 0 1-.5-.5V7.7a.5.5 0 0 1 .5-.5h8.6a.5.5 0 0 1 .5.5v8.6ZM15.6 6.9a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z' },
  { label: 'X', path: 'M17.5 6h2.1l-4.6 5.3L20.5 18h-4.2l-3.3-4.3L9.2 18H7l4.9-5.6L7 6h4.3l3 4 3.2-4Zm-.7 10.8h1.1L9.9 7.1H8.7l8.1 9.7Z' },
  { label: 'LinkedIn', path: 'M8.5 9.5H6V18h2.5V9.5ZM7.2 8.3a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8ZM18 13.3c0-2.4-1.3-3.5-3-3.5-1.4 0-2 .8-2.4 1.3V9.5H10V18h2.5v-4.5c0-1.1.5-1.8 1.5-1.8s1.5.7 1.5 1.8V18H18v-4.7Z' },
]

export function StoreFooter({ settings }: { settings: PublicSettings }) {
  const year = new Date().getFullYear()
  const tel = settings.supportPhone ? settings.supportPhone.replace(/\s/g, '') : null

  return (
    <footer className="mt-10 border-t border-line bg-white">
      <div className="container-x grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div>
          <Logo brandName={settings.brandName} tagline={settings.tagline} logoUrl={settings.logoUrl} />
          <p className="mt-3 text-[12.5px] leading-6 text-muted">
            Diagnostic laboratory serving {settings.city}, {settings.state}. Tests, health packages and home sample collection.
          </p>
          <ul className="mt-3 space-y-2 text-[12.5px] text-muted">
            {tel && <li><a href={`tel:${tel}`} className="flex items-center gap-2 transition hover:text-green"><Phone size={13} aria-hidden /> {settings.supportPhone}</a></li>}
            {settings.supportEmail && <li><a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2 transition hover:text-green"><Mail size={13} aria-hidden /> {settings.supportEmail}</a></li>}
            {settings.openingHours && <li className="flex items-start gap-2"><Clock3 size={13} className="mt-0.5 shrink-0" aria-hidden /> {settings.openingHours}</li>}
            {settings.address && <li className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden /> {settings.address}</li>}
          </ul>
          <div className="mt-4 flex gap-2">
            {SOCIALS.map((social) => <SocialIcon key={social.label} label={social.label} path={social.path} />)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[10.5px] leading-tight text-muted" title="App availability not configured">
              <Apple size={16} aria-hidden /><span><b className="block text-[11px] font-semibold text-ink">App Store</b>Not yet available</span>
            </span>
            <span className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[10.5px] leading-tight text-muted" title="App availability not configured">
              <Play size={16} aria-hidden /><span><b className="block text-[11px] font-semibold text-ink">Google Play</b>Not yet available</span>
            </span>
          </div>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-forest">{column.title}</h2>
            <ul className="mt-3 space-y-2 text-[12.5px] text-muted">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition hover:text-green">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line-soft">
        <div className="container-x flex flex-col items-center gap-3 py-5">
          <Logo brandName={settings.brandName} tagline={settings.tagline} logoUrl={settings.logoUrl} size="sm" />
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] text-muted">
            {LEGAL_LINKS.map((link) => <Link key={link.href} href={link.href} className="transition hover:text-green">{link.label}</Link>)}
            <Link href="/admin/login" className="font-medium transition hover:text-green">Admin login</Link>
          </nav>
          <p className="text-center text-[11px] leading-5 text-muted">
            © {year} {settings.brandName}. All rights reserved. This website is for appointment booking and information only — it is not an emergency service and does not provide medical advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
