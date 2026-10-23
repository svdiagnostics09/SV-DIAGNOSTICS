'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu, RefreshCw, X } from 'lucide-react'
import type { AdminUser } from '@/lib/auth'
import type { LucideIcon } from 'lucide-react'

export interface NavGroup { label: string; items: Array<{ key: string; label: string; icon: LucideIcon; badge?: number }> }

/** Logo tile for the sidebar: the uploaded logo, or the built-in initials mark. */
function BrandMark({ brand }: { brand: { brandName: string; logoUrl: string } }) {
  if (brand.logoUrl) {
    return (
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-white p-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logos vary in aspect ratio */}
        <img src={brand.logoUrl} alt={`${brand.brandName} logo`} className="size-full object-contain" />
      </span>
    )
  }
  const initials = brand.brandName.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase() || 'SV'
  return <span className="grid size-9 place-items-center rounded-[10px] bg-orange text-[13px] font-extrabold text-white">{initials}</span>
}

/**
 * Admin shell: fixed navy sidebar (desktop), white header with page title,
 * signed-in email, View Site and Logout — matching the reference dashboard.
 */
export function AdminShell({ user, groups, active, title, description, onNavigate, onRefresh, refreshing, children, mobileOpen, setMobileOpen, brand }: {
  user: AdminUser
  brand: { brandName: string; logoUrl: string }
  groups: NavGroup[]
  active: string
  title: string
  description?: string
  onNavigate: (key: string) => void
  onRefresh: () => void
  refreshing: boolean
  children: React.ReactNode
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}) {
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/auth/session', { method: 'DELETE', headers: { 'x-sv-request': 'fetch' } })
    router.replace('/admin/login')
    router.refresh()
  }

  const NavItems = (
    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="mb-1.5 px-2.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/35">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const selected = active === item.key
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => { onNavigate(item.key); setMobileOpen(false) }}
                    aria-current={selected ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13px] font-medium transition duration-200 ${selected ? 'bg-mint text-forest shadow-[0_8px_20px_-10px_rgba(20,184,154,0.95)]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon size={16} className="shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? <span className={`ml-auto rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${selected ? 'bg-forest/15 text-forest' : 'bg-white/10 text-white/80'}`}>{item.badge}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="admin-canvas min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="admin-rail fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-4">
          <BrandMark brand={brand} />
          <div className="min-w-0">
            <b className="block truncate text-[14px] font-bold leading-tight text-white">{brand.brandName}</b>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Admin Panel</span>
          </div>
        </div>
        {NavItems}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="rounded-xl bg-white/[0.07] px-2.5 py-2">
            <p className="truncate text-[11.5px] font-semibold leading-tight text-white">{user.name}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-white/50">{user.email} · <span className="uppercase tracking-wider text-mint">{user.role}</span></p>
          </div>
        </div>
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="admin-rail animate-in relative flex h-full w-72 flex-col">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2.5">
                <BrandMark brand={brand} />
                <div className="min-w-0"><b className="block truncate text-[14px] font-bold text-white">{brand.brandName}</b><span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Admin Panel</span></div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="grid size-8 place-items-center rounded-md text-white/70 hover:bg-white/10" aria-label="Close menu"><X size={17} aria-hidden /></button>
            </div>
            {NavItems}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="admin-topbar sticky top-0 z-30 border-b border-line bg-white/82 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-full border border-line lg:hidden" aria-label="Open menu"><Menu size={17} aria-hidden /></button>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold leading-tight">{title}</h1>
              {description && <p className="hidden truncate text-[11.5px] text-muted sm:block">{description}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={onRefresh} className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition hover:border-green hover:text-green sm:flex" aria-label="Refresh data">
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden /> Refresh
              </button>
              <span className="hidden max-w-[200px] truncate rounded-full bg-page px-3 py-1.5 text-[11.5px] font-medium text-muted md:block" title={user.email}>{user.email}</span>
              <a href="/" target="_blank" rel="noopener" className="btn btn-outline btn-sm">View site</a>
              <button type="button" onClick={logout} className="btn btn-ghost btn-sm" aria-label="Log out"><LogOut size={14} aria-hidden /><span className="hidden sm:inline">Logout</span></button>
            </div>
          </div>
        </header>
        <main className="page-enter mx-auto w-full max-w-[1600px] p-4 sm:p-6 [&>div]:min-h-[calc(100dvh-7rem)]">{children}</main>
      </div>
    </div>
  )
}

export function AdminSignOutInline() {
  const router = useRouter()
  return <button type="button" onClick={() => { void fetch('/api/admin/auth/session', { method: 'DELETE', headers: { 'x-sv-request': 'fetch' } }).then(() => router.replace('/admin/login')) }} className="btn btn-outline btn-sm"><LogOut size={14} aria-hidden /> Logout</button>
}
