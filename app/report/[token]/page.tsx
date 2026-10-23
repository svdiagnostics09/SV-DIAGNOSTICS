import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Clock3, Download, ShieldCheck } from 'lucide-react'
import { findReportByToken } from '@/lib/reports'
import { getSettings, publicSettings } from '@/lib/settings'
import { one } from '@/lib/db'
import { formatIndiaTime } from '@/lib/format'
import { Logo } from '@/components/storefront/logo'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your report', robots: { index: false, follow: false } }

/**
 * Patient report page — the link sent on WhatsApp.
 *
 * The token in the URL is the only credential, which is why it is 32 random
 * bytes, expires, and is revoked when a newer report is uploaded. The page is
 * noindex so the link never appears in search results.
 */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const report = await findReportByToken(token)
  if (!report) notFound()

  const [settings, booking] = await Promise.all([
    getSettings(),
    one<{ reference: string; patient_name: string; appointment_date: string; slot_label: string }>(
      'SELECT reference, patient_name, appointment_date::text AS appointment_date, slot_label FROM bookings WHERE id = $1',
      [report.bookingId],
    ),
  ])
  const site = publicSettings(settings)

  return (
    <main className="min-h-screen bg-page">
      <header className="border-b border-line bg-white">
        <div className="container-x flex items-center justify-between py-3">
          <Logo brandName={site.brandName} tagline={site.tagline} logoUrl={site.logoUrl} size="sm" />
          <Link href="/" className="text-[12px] font-medium text-muted hover:text-green">Back to website</Link>
        </div>
      </header>

      <div className="container-x max-w-xl py-10">
        <div className="card overflow-hidden">
          <div className="border-b border-line bg-mint-50 px-6 py-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-mint-700">
              <CheckCircle2 size={13} aria-hidden /> Report ready
            </span>
            <h1 className="mt-2 text-[1.35rem] font-bold leading-tight tracking-[-0.02em] text-forest">
              {booking ? `${booking.patient_name.split(' ')[0]}, your report is ready` : 'Your report is ready'}
            </h1>
            {booking && (
              <p className="mt-1 text-[12.5px] text-muted">
                {booking.reference} · collected {formatIndiaTime(`${booking.appointment_date}T12:00:00+05:30`, { day: 'numeric', month: 'long', year: 'numeric' })}
                {booking.slot_label ? ` · ${booking.slot_label}` : ''}
              </p>
            )}
          </div>

          <div className="space-y-3 px-6 py-5">
            <p className="text-[13px] leading-6 text-ink/80">
              This link is personal to you. Anyone who has it can download the report, so please do not forward it.
            </p>
            <a href={`/report/${encodeURIComponent(token)}/download`} className="btn btn-primary w-full">
              <Download size={15} aria-hidden /> Download PDF report
            </a>
            <p className="flex items-start gap-1.5 text-[11.5px] leading-5 text-muted">
              <Clock3 size={12} className="mt-0.5 shrink-0" aria-hidden />
              {report.expiresAt
                ? `This link expires on ${formatIndiaTime(report.expiresAt, { day: 'numeric', month: 'long', year: 'numeric' })}. Ask the laboratory for a fresh link after that.`
                : 'Ask the laboratory for a fresh link if this one stops working.'}
            </p>
            {site.supportPhone && (
              <p className="flex items-start gap-1.5 text-[11.5px] leading-5 text-muted">
                <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden />
                Questions about these results? Call {site.supportPhone} with reference {booking?.reference ?? ''}.
              </p>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted">Confidential medical information · {site.brandName}</p>
      </div>
    </main>
  )
}
