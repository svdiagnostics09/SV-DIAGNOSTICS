'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Headphones, LogIn, Menu, Phone, ShoppingBag, Store, X } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { useCity } from '@/components/storefront/city-provider'
import { useStoreUI } from '@/components/storefront/ui-provider'
import { Logo } from '@/components/storefront/logo'
import { LocationSelector } from '@/components/storefront/location-selector'
import { PromoBar } from '@/components/storefront/promo-bar'
import type { PublicSettings } from '@/lib/settings'

const NAV = [
  { label: 'Tests', href: '/tests' },
  { label: 'Checkups', href: '/packages' },
  { label: 'Home collection', href: '/home-collection' },
  { label: 'Locations', href: '/locations' },
]

export function StoreHeader({ settings }: { settings: PublicSettings }) {
  const pathname = usePathname()
  const cart = useCart()
  const { openCart } = useStoreUI()
  const { city } = useCity()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))
  const tel = settings.supportPhone ? settings.supportPhone.replace(/\s/g, '') : null

  return (
    <header className="sticky top-0 z-40">
      {settings.announcementEnabled && settings.announcement && (
        <PromoBar message={settings.announcement} offerLabel="Full body checkup from" offerPrice="₹1,599" />
      )}

      <div className="store-header-main border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="container-x flex h-16 items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink transition hover:bg-section lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="store-mobile-nav"
          >
            <Menu size={20} aria-hidden />
          </button>

          <Logo brandName={settings.brandName} tagline={settings.tagline} logoUrl={settings.logoUrl} className="shrink-0" />

          <span className="mx-1 hidden h-6 w-px bg-line lg:block" aria-hidden />
          <div className="hidden lg:block"><LocationSelector /></div>

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`store-nav-link whitespace-nowrap rounded-full px-3 py-2 text-[13.5px] font-medium transition ${isActive(item.href) ? 'bg-mint-50 text-mint-700' : 'text-ink hover:bg-section'
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-2">
            <Link href="/track" className="hidden items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium text-muted transition hover:bg-section hover:text-ink xl:flex">
              <Store size={15} aria-hidden /> Track booking
            </Link>

            {tel ? (
              <a href={`tel:${tel}`} className="btn btn-outline btn-sm hidden items-center gap-1.5 sm:inline-flex" aria-label={`Call support on ${settings.supportPhone}`}>
                <Headphones size={14} aria-hidden /> Support
              </a>
            ) : (
              <Link href="/contact" className="btn btn-outline btn-sm hidden items-center gap-1.5 sm:inline-flex">
                <Headphones size={14} aria-hidden /> Support
              </Link>
            )}

            <button
              type="button"
              onClick={openCart}
              className="relative grid size-10 place-items-center rounded-full border border-line bg-white/80 text-forest shadow-[0_4px_12px_-10px_rgba(14,76,69,0.6)] transition hover:-translate-y-0.5 hover:border-green hover:text-green"
              aria-label={`Open cart${cart.count ? `, ${cart.count} item${cart.count === 1 ? '' : 's'}` : ', empty'}`}
            >
              <ShoppingBag size={17} aria-hidden />
              {cart.ready && cart.count > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-orange px-1 text-[10px] font-bold leading-[18px] text-white">
                  {cart.count}
                </span>
              )}
            </button>

            <Link href="/book" className="btn btn-primary btn-sm hidden sm:inline-flex">
              Book Now
            </Link>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div id="store-mobile-nav" className="animate-in fixed inset-0 z-50 bg-white lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Logo brandName={settings.brandName} tagline={settings.tagline} logoUrl={settings.logoUrl} size="sm" href={null} />
            <button type="button" onClick={() => setMenuOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-section" aria-label="Close menu">
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: 'calc(100dvh - 4rem)' }}>
            <LocationSelector />
            <nav aria-label="Mobile" className="mt-3 flex flex-col">
              {[...NAV, { label: 'Track booking', href: '/track' }, { label: 'Health articles', href: '/blog' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map((item) => (
                <Link key={item.href} href={item.href} className={`rounded-xl px-3 py-3 text-[15px] font-medium ${isActive(item.href) ? 'bg-mint-50 text-mint-700' : 'text-ink'}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="mt-4 px-1 text-[11px] text-muted">Showing prices and slots for {city.name}.</p>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => { setMenuOpen(false); openCart() }} className="btn btn-outline justify-between">
                View cart <span>{cart.ready && cart.count > 0 ? `(${cart.count})` : ''}</span>
              </button>
              <Link href="/book" onClick={() => setMenuOpen(false)} className="btn btn-primary">Book Now</Link>
              {tel && <a href={`tel:${tel}`} className="btn btn-ghost"><Phone size={15} aria-hidden /> {settings.supportPhone}</a>}
              <Link href="/admin/login" className="btn btn-ghost"><LogIn size={15} aria-hidden /> Admin login</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
