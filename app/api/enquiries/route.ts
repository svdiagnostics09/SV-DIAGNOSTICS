import { createEnquiry } from '@/lib/content'
import { clientKey, isRateLimited, recordAttempt } from '@/lib/auth'
import { notifyStaffEmail } from '@/lib/notify'
import { emailSchema, firstIssue, nameSchema, parseJson, phoneSchema } from '@/lib/validation'
import { z, ZodError } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  subject: z.string().trim().max(120).default(''),
  message: z.string().trim().min(10, 'Please describe your query in at least 10 characters.').max(2000, 'Please keep your message under 2000 characters.'),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0).optional().or(z.literal('')),
})

export async function POST(request: Request) {
  const key = clientKey(request, 'enquiry')
  try {
    if (await isRateLimited(key, 5, 30)) return Response.json({ error: 'Too many enquiries from this connection. Please try again later.' }, { status: 429 })
    const body = await parseJson(request, schema)
    if (body.website) return Response.json({ reference: 'ENQ-RECEIVED' }, { status: 201 }) // silently drop bots
    const enquiry = await createEnquiry({ name: body.name, phone: body.phone, email: body.email || undefined, subject: body.subject, message: body.message })
    await recordAttempt(key)
    void notifyStaffEmail({ subject: `New enquiry ${enquiry.reference}`, text: `From ${enquiry.name} (${enquiry.phone})\nSubject: ${enquiry.subject}\n\n${enquiry.message}`, bookingId: null }).catch(() => undefined)
    return Response.json({ reference: enquiry.reference }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    console.error('[enquiry]', error)
    return Response.json({ error: 'Your enquiry could not be sent. Please call the laboratory instead.' }, { status: 503 })
  }
}
