import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, CircleDollarSign, Home, MapPin, MessageSquare, Printer, ShieldCheck } from 'lucide-react'
import { getBookingForConfirmation, STATUS_LABELS } from '@/lib/booking'
import { formatINR, formatIndiaTime } from '@/lib/db'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { Badge } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Booking confirmation', robots: { index: false } }

const PAYMENT_COPY: Record<string, string> = {
  pay_lab: 'Pay at the laboratory',
  pay_home: 'Pay at collection',
}

export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { reference } = await params
  const query = await searchParams
  const token = typeof query.t === 'string' ? query.t : ''
  const [booking, { settings }] = await Promise.all([getBookingForConfirmation(reference, token), siteShell()])
  if (!booking) notFound()
  const paid = booking.paymentStatus === 'paid'

  return (
    <SiteShell settings={settings}>
      <div className="container-x max-w-3xl py-10">
        <div className="card p-6 sm:p-8" id="confirmation">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700">
              <CheckCircle2 size={24} aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Booking {STATUS_LABELS[booking.status]}</p>
              <h1 className="mt-0.5 text-[1.6rem] font-bold tracking-[-0.02em]">Thank you, {booking.patientName.split(' ')[0]}</h1>
              <p className="mt-1 text-[13px] text-muted">Your booking has been saved. Keep the reference below to track it.</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-line bg-page p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Booking reference</p>
            <p className="mt-1 font-mono text-[22px] font-bold tracking-wider text-navy">{booking.reference}</p>
            <p className="mt-2 text-[12px] leading-5 text-muted">Track this booking with your reference and the mobile number ending in <b className="text-ink">…{booking.phone.slice(-4)}</b>. Do not share the reference publicly.</p>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Appointment</dt>
              <dd className="text-[13.5px] font-medium">{formatIndiaTime(`${booking.appointmentDate}T12:00:00+05:30`, { weekday: 'long', day: 'numeric', month: 'long' })}</dd>
              <dd className="text-[13px] text-muted">{booking.slotLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Collection</dt>
              <dd className="flex items-center gap-1.5 text-[13.5px] font-medium">{booking.method === 'home' ? <><Home size={14} aria-hidden /> Home collection</> : <><MapPin size={14} aria-hidden /> Laboratory visit</>}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Patient</dt>
              <dd className="text-[13.5px] font-medium">{booking.patientName}</dd>
              <dd className="text-[13px] text-muted">{booking.phone}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Payment</dt>
              <dd className="flex items-center gap-1.5 text-[13.5px] font-medium"><CircleDollarSign size={14} aria-hidden /> {PAYMENT_COPY[booking.paymentMethod]}</dd>
              <dd className="text-[13px] text-muted capitalize">Status: {booking.paymentStatus}{paid ? '' : ' — not confirmed'}</dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-line pt-4">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">Items</h2>
            <ul className="mt-2 divide-y divide-line">
              {booking.items.map((item) => (
                <li key={item.name} className="flex justify-between gap-3 py-2 text-[13px]"><span>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span><span className="tabular-nums">{formatINR(item.unitPricePaise * item.quantity)}</span></li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 text-[13px]">
              {booking.discountPaise > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="tabular-nums text-success">− {formatINR(booking.discountPaise)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold text-navy"><dt>Total</dt><dd className="tabular-nums">{formatINR(booking.totalPaise)}</dd></div>
            </dl>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/track?ref=${encodeURIComponent(booking.reference)}`} className="btn btn-primary">Track booking</Link>
            <Link href="/" className="btn btn-outline">Back to home</Link>
            <a href="/contact" className="btn btn-ghost"><MessageSquare size={15} aria-hidden /> Need help?</a>
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-[11.5px] leading-5 text-muted"><ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden /> Save this page or the email confirmation. Your booking status updates only when laboratory staff or a verified payment event changes it. <Printer size={13} className="mt-0.5 shrink-0" aria-hidden /><span className="sr-only">Print this page from your browser to keep a copy.</span></p>
        </div>
      </div>
    </SiteShell>
  )
}
