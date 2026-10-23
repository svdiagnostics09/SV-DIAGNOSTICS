import type { Metadata } from 'next'
import { Lock } from 'lucide-react'
import { currentAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/admin/login-form'
import { getSettings, publicSettings } from '@/lib/settings'
import { Logo } from '@/components/storefront/logo'

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const admin = await currentAdmin()
  if (admin) redirect('/admin')
  const site = publicSettings(await getSettings())
  return (
    <div className="admin-login-shell grid min-h-screen bg-page lg:grid-cols-2">
      <div className="admin-rail relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div aria-hidden className="motion-float pointer-events-none absolute -right-24 top-24 size-80 rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-8 size-72 rounded-full bg-mint/10" />
        <div className="relative flex items-center gap-2.5">
          <Logo brandName={site.brandName} tagline="Admin panel" logoUrl={site.logoUrl} size="sm" href={null} className="[&_b]:text-white [&_span]:text-white/60" />
        </div>
        <div className="relative motion-rise">
          <span className="inline-flex rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-[11px] font-semibold tracking-wide text-mint">Secure operations workspace</span>
          <h1 className="mt-4 max-w-md text-[2rem] font-bold leading-tight text-white">Operate the laboratory catalogue, bookings and reports.</h1>
          <p className="mt-3 max-w-sm text-[13.5px] leading-6 text-white/65">Access is restricted to authorised administrators. Sign-in attempts are rate limited and sensitive actions are written to an audit log.</p>
        </div>
        <p className="relative text-[11.5px] text-white/40">Session-based authentication · scrypt password hashing</p>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="motion-rise w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo brandName={site.brandName} tagline="Admin panel" logoUrl={site.logoUrl} size="sm" href={null} />
          </div>
          <span className="eyebrow">Laboratory administration</span>
          <h2 className="mt-1 text-[1.7rem] font-bold tracking-tight">Sign in to the console</h2>
          <p className="mt-1 text-[13px] text-muted">Use the administrator credentials issued by the laboratory owner.</p>
          <LoginForm />
          <a href="/" className="mt-6 inline-block text-[12.5px] font-medium text-muted hover:text-teal-700">← Back to website</a>
        </div>
      </div>
    </div>
  )
}
