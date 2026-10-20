import type { Metadata } from 'next'

/**
 * Config-driven legal pages. Text is written from the business model in the
 * brief; it avoids compliance claims and matches how the platform actually
 * handles data, payments and cancellations.
 */
const PAGES = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what SV Diagnostics collects when you use this website and how it is used. It describes the platform as built — no third-party analytics or advertising trackers are loaded by default.',
    sections: [
      { heading: 'Information we collect', body: 'Booking details (patient name, age, gender, mobile number, optional email, collection address and pincode), selected tests and packages, appointment slot, consent records, payment status and references, and enquiry messages. Administrator accounts store an email, display name and a salted password hash.' },
      { heading: 'How we use it', body: 'To schedule and deliver sample collection, calculate prices, process bookings, respond to enquiries, send booking notifications you request, and keep records required to operate a diagnostic laboratory.' },
      { heading: 'Payments', body: 'Online payments are processed by Razorpay. Card and UPI details are entered in Razorpay’s interface and are never stored on our servers. We store only the payment order and payment identifiers needed to reconcile a booking.' },
      { heading: 'Who can access your data', body: 'Authorised administrators can view bookings and enquiries to operate the laboratory. Access to patient records requires an authenticated session; every sensitive action is written to an audit log.' },
      { heading: 'Retention', body: 'Booking and consent records are retained while needed to provide the service and to satisfy applicable record-keeping obligations. Enquiries may be archived after they are resolved.' },
      { heading: 'Your choices', body: 'You can request access to, correction of, or deletion of your contact details where the law permits by contacting the laboratory. Some records must be retained for medical and legal reasons.' },
      { heading: 'Security', body: 'Sessions use HTTP-only cookies, passwords are stored as scrypt hashes, all database access is parameterised, and sensitive endpoints are rate limited. No internet service can be guaranteed to be completely secure.' },
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: 'By using this website or booking a test you agree to these terms.',
    sections: [
      { heading: 'Bookings', body: 'A booking is a request for service and becomes confirmed when shown as confirmed in our system. We may reschedule or decline a booking if a slot, test or collection is unavailable, or if safe collection is not possible.' },
      { heading: 'Pricing', body: 'Prices shown come from our published catalogue and may change. The amount payable is recalculated on our server when the booking is confirmed. Any discrepancy will be resolved before service is delivered.' },
      { heading: 'Preparation and eligibility', body: 'You are responsible for following preparation instructions. Some tests require a laboratory visit or a prescription. Home collection depends on the pincode and the test.' },
      { heading: 'Reports', body: 'Results are released through your booking page and to the registered contact details. They are for information and must be interpreted by a qualified medical practitioner. This website does not provide diagnosis or treatment.' },
      { heading: 'Acceptable use', body: 'Do not attempt to access other patients’ records, probe the service for vulnerabilities, or submit false information. Access to administrator areas is restricted.' },
      { heading: 'Liability', body: 'To the extent permitted by law, the laboratory is not liable for indirect losses arising from delays caused by events outside its control. Nothing in these terms limits rights available to patients under applicable law.' },
    ],
  },
  'refund-policy': {
    title: 'Cancellation & Refund Policy',
    intro: 'This policy explains how cancellations and refunds are handled for bookings made on this website.',
    sections: [
      { heading: 'Cancelling online', body: 'You can cancel through the booking tracking page within the cancellation window shown at checkout (by default 4 hours before the appointment), provided collection has not taken place. The slot is released back to capacity immediately.' },
      { heading: 'Refunds for online payments', body: 'If you cancel an online-paid booking before collection, the refund is recorded against the booking. Refunds are issued to the original payment method through Razorpay and can take several business days to appear, depending on your bank.' },
      { heading: 'Pay at collection / laboratory', body: 'Bookings paid at collection or at the laboratory have no amount to refund if collected. If a sample could not be collected, no charge applies for the visit.' },
      { heading: 'Cancellation by the laboratory', body: 'If we cannot complete a collection, we will offer a reschedule or a refund of any amount already paid for that booking.' },
      { heading: 'After collection', body: 'Once a sample has been collected and processing has begun, cancellation may not be possible. Contact the laboratory to discuss your options.' },
      { heading: 'How to request help', body: 'Use the contact form or call the laboratory with your booking reference. Every refund action is recorded in our audit trail.' },
    ],
  },
} as const

export const metadata: Metadata = {
  title: 'Legal',
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = PAGES[slug as keyof typeof PAGES]
  if (!page) {
    const { notFound } = await import('next/navigation')
    notFound()
  }
  return (
    <article className="container-x max-w-3xl py-10">
      <p className="eyebrow">SV Diagnostics</p>
      <h1 className="mt-1 text-[1.9rem] font-bold tracking-[-0.025em]">{page!.title}</h1>
      <p className="mt-3 text-[14px] leading-7 text-muted">{page!.intro}</p>
      <p className="mt-2 text-[12px] text-muted">Last updated {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
      <div className="mt-6 space-y-4">
        {page!.sections.map((section) => (
          <section key={section.heading} className="card p-5">
            <h2 className="text-[15px] font-bold">{section.heading}</h2>
            <p className="mt-1.5 text-[13.5px] leading-7 text-muted">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-[12.5px] leading-6 text-muted">This page is provided for transparency about how the platform operates. It is not a substitute for legal advice. Questions can be sent through the <a className="link" href="/contact">contact form</a>.</p>
    </article>
  )
}
