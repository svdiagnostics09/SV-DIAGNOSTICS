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
    <div className="grid min-h-screen bg-page lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo brandName={site.brandName} tagline="Admin panel" logoUrl={site.logoUrl} size="sm" href={null} className="[&_b]:text-white [&_span]:text-white/60" />
        </div>
        <div>
          <h1 className="max-w-md text-[2rem] font-bold leading-tight text-white">Operate the laboratory catalogue, bookings and reports.</h1>
          <p className="mt-3 max-w-sm text-[13.5px] leading-6 text-white/65">Access is restricted to authorised administrators. Sign-in attempts are rate limited and sensitive actions are written to an audit log.</p>
        </div>
        <p className="text-[11.5px] text-white/40">Session-based authentication · scrypt password hashing</p>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo brandName={site.brandName} tagline="Admin panel" logoUrl={site.logoUrl} size="sm" href={null} />
          </div>
          <h2 className="text-[1.5rem] font-bold tracking-tight">Sign in to the console</h2>
          <p className="mt-1 text-[13px] text-muted">Use the administrator credentials issued by the laboratory owner.</p>
          <LoginForm />
          <a href="/" className="mt-6 inline-block text-[12.5px] font-medium text-muted hover:text-teal-700">← Back to website</a>
        </div>
      </div>
    </div>
  )
}
