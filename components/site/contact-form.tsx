'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Send } from 'lucide-react'

/** Contact form — posts to /api/enquiries and shows real success/failure states. */
export function ContactForm({ subjects }: { subjects: string[] }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: subjects[0] ?? 'General enquiry', message: '', website: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const nextErrors: Record<string, string> = {}
    if (form.name.trim().length < 2) nextErrors.name = 'Please enter your name.'
    if (!/^(\+91)?[6-9]\d{9}$/.test(form.phone.replace(/[\s()-]/g, ''))) nextErrors.phone = 'Enter a valid 10-digit mobile number.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (form.message.trim().length < 10) nextErrors.message = 'Please describe your query in at least 10 characters.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setStatus('sending')
    const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' }, body: JSON.stringify(form) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setStatus('idle'); setError(body.error ?? 'Your enquiry could not be sent. Please try again.'); return }
    setReference(body.reference ?? '')
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <div className="card p-8 text-center" role="status">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-teal-50 text-teal-700"><CheckCircle2 size={24} aria-hidden /></span>
        <h2 className="mt-4 text-[18px] font-bold">Your enquiry has been received</h2>
        <p className="mt-1.5 text-[13.5px] leading-6 text-muted">Our team will respond during laboratory hours. Your reference is <b className="font-mono text-ink">{reference}</b>.</p>
        <button type="button" onClick={() => { setStatus('idle'); setForm({ name: '', phone: '', email: '', subject: subjects[0] ?? 'General enquiry', message: '', website: '' }) }} className="btn btn-outline btn-sm mt-5">Send another enquiry</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="card p-6">
      <h2 className="text-[17px] font-bold">Send us a message</h2>
      <p className="mt-1 text-[13px] text-muted">For appointments and results, please use the booking and tracking tools. Do not share medical reports in this form.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="label">Full name</label>
          <input id="contact-name" value={form.name} onChange={set('name')} className="input" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'err-name' : undefined} />
          {errors.name && <p id="err-name" className="mt-1 text-[11.5px] text-danger">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="contact-phone" className="label">Mobile number</label>
          <input id="contact-phone" value={form.phone} onChange={set('phone')} className="input" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'err-phone' : undefined} />
          {errors.phone && <p id="err-phone" className="mt-1 text-[11.5px] text-danger">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="contact-email" className="label">Email <span className="font-normal text-muted">(optional)</span></label>
          <input id="contact-email" value={form.email} onChange={set('email')} type="email" className="input" autoComplete="email" aria-invalid={Boolean(errors.email)} />
          {errors.email && <p className="mt-1 text-[11.5px] text-danger">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="contact-subject" className="label">Subject</label>
          <select id="contact-subject" value={form.subject} onChange={set('subject')} className="input">
            {subjects.map((subject) => <option key={subject}>{subject}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="contact-message" className="label">Message</label>
          <textarea id="contact-message" value={form.message} onChange={set('message')} rows={5} className="input" maxLength={2000} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'err-message' : undefined} />
          {errors.message && <p id="err-message" className="mt-1 text-[11.5px] text-danger">{errors.message}</p>}
        </div>
        <div className="hidden" aria-hidden>
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12.5px] text-danger">{error}</p>}
      <button type="submit" disabled={status === 'sending'} className="btn btn-primary mt-5 w-full sm:w-auto">
        {status === 'sending' ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Sending…</> : <><Send size={15} aria-hidden /> Send enquiry</>}
      </button>
      <p className="mt-3 text-[11.5px] leading-5 text-muted">By sending this form you agree to our <a href="/privacy" className="link">privacy policy</a>. We use your details only to respond to this enquiry.</p>
    </form>
  )
}
