'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  FlaskConical,
  Home,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShoppingBag,
  TestTube2,
  X,
} from 'lucide-react'
import { CartProvider, useCart } from '@/components/cart-provider'
import type { PublicSettings } from '@/lib/settings'

const NAV = [
  { label: 'Tests', href: '/tests', children: [{ label: 'Diagnostic tests', href: '/tests', desc: 'Browse the full catalogue' }, { label: 'Price list', href: '/price-list', desc: 'Searchable price list' }, { label: 'Health packages', href: '/packages', desc: 'Bundled check-ups' }] },
  { label: 'Health packages', href: '/packages' },
  { label: 'Home collection', href: '/home-collection' },
  { label: 'Locations', href: '/locations' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export function SiteShell({ settings, children }: { settings: PublicSettings; children: React.ReactNode }) {
  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <Header settings={settings} />
      <main id="main">{children}</main>
      <Footer settings={settings} />
    </CartProvider>
  )
}

function Header({ settings }: { settings: PublicSettings }) {
  const pathname = usePathname()
  const cart = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  useEffect(() => {
    setMenuOpen(false)
    setOpenGroup(null)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      {settings.announcementEnabled && settings.announcement && (
        <div className="bg-navy text-white">
          <div className="container-x flex min-h-9 items-center justify-center gap-2 py-1.5 text-center text-[12px] sm:text-[12.5px]">
            <Home size={13} aria-hidden className="hidden shrink-0 sm:block" />
            <span className="truncate">{settings.announcement}</span>
            <Link href="/tests" className="ml-1 hidden shrink-0 font-semibold text-[#7fe3d6] hover:underline sm:inline">Book now</Link>
          </div>
        </div>
      )}
      <div className="border-b border-line">
        <div className="container-x flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${settings.brandName} home`}>
            <span className="grid size-9 place-items-center rounded-lg bg-navy text-white"><TestTube2 size={19} aria-hidden /></span>
            <span className="leading-tight">
              <b className="block text-[15.5px] font-bold tracking-tight text-navy">{settings.brandName}</b>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">{settings.tagline}</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => (
              <div key={item.label} className="relative" onMouseLeave={() => setOpenGroup(null)}>
                <Link
                  href={item.href}
                  onMouseEnter={() => setOpenGroup(item.children ? item.label : null)}
                  className={`flex items-center gap-1 rounded-md px-3 py-2 text-[13.5px] font-medium transition ${isActive(item.href) ? 'bg-teal-50 text-teal-700' : 'text-ink hover:bg-page hover:text-navy'}`}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.label}
                  {item.children && <ChevronDown size={13} aria-hidden />}
                </Link>
                {item.children && openGroup === item.label && (
                  <div className="absolute left-0 top-full z-50 w-60 pt-1.5">
                    <div className="card p-1.5 shadow-card">
                      {item.children.map((child) => (
                        <Link key={child.href} href={child.href} className="block rounded-md px-3 py-2 hover:bg-page">
                          <b className="block text-[13px] font-semibold text-navy">{child.label}</b>
                          <span className="block text-[11.5px] text-muted">{child.desc}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/book" className="relative hidden size-10 place-items-center rounded-lg border border-line text-navy transition hover:border-teal hover:text-teal-700 sm:grid" aria-label={`Booking cart${cart.count ? `, ${cart.count} items` : ''}`}>
              <ShoppingBag size={17} aria-hidden />
              {cart.ready && cart.count > 0 && (
                <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-teal text-[10px] font-bold text-white">{cart.count}</span>
              )}
            </Link>
            <Link href="/tests" className="btn btn-primary hidden sm:inline-flex">Book a test <ArrowRight size={15} aria-hidden /></Link>
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-nav" className="grid size-10 place-items-center rounded-lg border border-line lg:hidden">
              {menuOpen ? <X size={19} aria-hidden /> : <Menu size={19} aria-hidden />}
              <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-nav" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0px)] z-50 h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white lg:hidden">
          <nav aria-label="Mobile" className="container-x flex flex-col py-4">
            {NAV.flatMap((item) => [item, ...(item.children ?? [])]).map((item, index) => (
              <Link key={`${item.href}-${index}`} href={item.href} className={`rounded-md px-3 py-3 text-[15px] font-medium ${isActive(item.href) ? 'bg-teal-50 text-teal-700' : 'text-ink'}`}>
                {item.label}
              </Link>
            ))}
            <Link href="/faq" className="rounded-md px-3 py-3 text-[15px] font-medium text-ink">FAQ</Link>
            <Link href="/track" className="rounded-md px-3 py-3 text-[15px] font-medium text-ink">Track a booking</Link>
            <div className="mt-3 grid gap-2">
              <Link href="/book" className="btn btn-outline justify-between">View booking cart <span>{cart.ready && cart.count > 0 ? `(${cart.count})` : ''}</span></Link>
              <Link href="/tests" className="btn btn-primary">Book a test <ArrowRight size={15} aria-hidden /></Link>
              {settings.supportPhone && <a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="btn btn-ghost"><Phone size={15} aria-hidden /> {settings.supportPhone}</a>}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

function Footer({ settings }: { settings: PublicSettings }) {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-navy text-white"><TestTube2 size={18} aria-hidden /></span>
            <div>
              <b className="block text-[15px] font-bold text-navy">{settings.brandName}</b>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">{settings.tagline}</span>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-6 text-muted">
            Diagnostic laboratory serving {settings.city}, {settings.state}. Tests, health packages and home sample collection.
          </p>
          <p className="mt-3 text-[11.5px] leading-5 text-muted">This website is for appointment booking and information only. It is not an emergency service and does not provide medical advice.</p>
        </div>

        <nav aria-label="Catalogue">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-navy">Catalogue</h2>
          <ul className="mt-3 space-y-2 text-[13px] text-muted">
            <li><Link href="/tests" className="hover:text-teal-700">Diagnostic tests</Link></li>
            <li><Link href="/price-list" className="hover:text-teal-700">Price list</Link></li>
            <li><Link href="/packages" className="hover:text-teal-700">Health packages</Link></li>
            <li><Link href="/service-areas" className="hover:text-teal-700">Service areas</Link></li>
            <li><Link href="/locations" className="hover:text-teal-700">Laboratory locations</Link></li>
          </ul>
        </nav>

        <nav aria-label="Support">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-navy">Support</h2>
          <ul className="mt-3 space-y-2 text-[13px] text-muted">
            <li><Link href="/track" className="hover:text-teal-700">Track a booking</Link></li>
            <li><Link href="/faq" className="hover:text-teal-700">FAQ</Link></li>
            <li><Link href="/blog" className="hover:text-teal-700">Health articles</Link></li>
            <li><Link href="/about" className="hover:text-teal-700">About us</Link></li>
            <li><Link href="/contact" className="hover:text-teal-700">Contact</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-navy">Contact</h2>
          <ul className="mt-3 space-y-2.5 text-[13px] text-muted">
            {settings.supportPhone && <li><a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-teal-700"><Phone size={14} aria-hidden /> {settings.supportPhone}</a></li>}
            {settings.supportEmail && <li><a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2 hover:text-teal-700"><Mail size={14} aria-hidden /> {settings.supportEmail}</a></li>}
            {settings.openingHours && <li className="flex items-start gap-2"><Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden /> {settings.openingHours}</li>}
            {settings.address && <li className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden /> {settings.address}</li>}
            <li className="flex items-center gap-2"><FlaskConical size={14} aria-hidden /> {settings.city}, {settings.state}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-3 py-5 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {settings.brandName}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-teal-700">Privacy policy</Link>
            <Link href="/terms" className="hover:text-teal-700">Terms of use</Link>
            <Link href="/refund-policy" className="hover:text-teal-700">Cancellation &amp; refunds</Link>
            <Link href="/patient-consent" className="hover:text-teal-700">Patient consent</Link>
            <Link href="/admin/login" className="font-medium hover:text-teal-700">Admin login</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
