import { createBooking, BookingError, priceCart, type CartItemInput } from '@/lib/booking'
import { clientKey, ipHash, isRateLimited, recordAttempt } from '@/lib/auth'
import { emailConfigured, sendBookingConfirmationEmail, notifyStaffEmail } from '@/lib/notify'
import { createRazorpayOrder, publicPaymentStatus, razorpayConfigured } from '@/lib/payments'
import { getSettings } from '@/lib/settings'
import { emailSchema, firstIssue, nameSchema, parseJson, phoneSchema } from '@/lib/validation'
import { z, ZodError } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  items: z.array(z.object({
    kind: z.enum(['test', 'package']),
    id: z.number().int().positive(),
    quantity: z.number().int().min(1).max(5).default(1),
  })).min(1, 'Select at least one test or package.').max(12),
  method: z.enum(['home', 'lab']),
  locationId: z.number().int().positive().nullable().optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode.').optional().or(z.literal('')),
  addressLine: z.string().trim().max(240).optional().or(z.literal('')),
  addressArea: z.string().trim().max(120).optional().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose an appointment date.'),
  slotId: z.number().int().positive({ message: 'Choose a time slot.' }),
  patientName: nameSchema,
  patientAge: z.number().int().min(0).max(120).nullable().optional(),
  patientGender: z.enum(['male', 'female', 'other']).nullable().optional(),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  paymentMethod: z.enum(['online', 'pay_lab', 'pay_home']),
  consent: z.literal(true).optional().refine((value) => value === true, { message: 'Please accept the patient consent and booking terms.' }),
  idempotencyKey: z.string().min(8).max(80).optional(),
  /** Honeypot */
  website: z.string().max(0).optional().or(z.literal('')),
})

/** Preview pricing: the same server-side calculation used on creation. */
export async function POST(request: Request) {
  const key = clientKey(request, 'booking')
  try {
    if (await isRateLimited(key, 30, 10)) return Response.json({ error: 'Too many booking attempts. Please wait a few minutes.' }, { status: 429 })
    const body = await parseJson(request, schema)
    if (body.website) return Response.json({ error: 'Invalid request.' }, { status: 400 })
    await recordAttempt(key)

    const items: CartItemInput[] = body.items
    const settings = await getSettings()
    const booking = await createBooking({
      items,
      method: body.method,
      locationId: body.locationId ?? null,
      pincode: body.pincode || undefined,
      addressLine: body.addressLine || undefined,
      addressArea: body.addressArea || undefined,
      date: body.date,
      slotId: body.slotId,
      patientName: body.patientName,
      patientAge: body.patientAge ?? null,
      patientGender: body.patientGender ?? null,
      phone: body.phone,
      email: body.email || null,
      paymentMethod: body.paymentMethod,
      consentAccepted: body.consent,
      idempotencyKey: body.idempotencyKey ?? null,
      ipHash: ipHash(request),
      userAgent: request.headers.get('user-agent') ?? '',
    })

    const origin = new URL(request.url).origin
    const trackingLink = `${origin}/track?ref=${encodeURIComponent(booking.reference)}`

    // Notifications are best-effort and never fail the booking.
    void sendBookingConfirmationEmail({
      bookingId: booking.id, email: body.email || null, reference: booking.reference, patientName: body.patientName,
      date: body.date, slot: '', totalPaise: booking.totalPaise, trackingLink,
    }).catch((error) => console.error('[notify] confirmation failed', error))
    void notifyStaffEmail({
      subject: `New booking ${booking.reference}`,
      text: `Booking ${booking.reference}\nPatient: ${body.patientName}\nMethod: ${body.method}\nDate: ${body.date}\nAmount: ₹${(booking.totalPaise / 100).toFixed(2)}\nPayment: ${body.paymentMethod}\nPhone: ${body.phone}`,
      bookingId: booking.id,
    }).catch((error) => console.error('[notify] staff alert failed', error))

    let payment: { provider: string; orderId: string; amountPaise: number; keyId: string } | null = null
    let paymentError: string | null = null
    if (body.paymentMethod === 'online') {
      if (!razorpayConfigured()) {
        paymentError = 'Online payment is not configured. Your booking is saved — pay at collection or contact the laboratory.'
      } else {
        try {
          const created = await createRazorpayOrder({ bookingId: booking.id, reference: booking.reference, amountPaise: booking.totalPaise, email: body.email || null, phone: body.phone })
          payment = { provider: 'razorpay', ...created }
        } catch (error) {
          console.error('[payments] order creation failed', error)
          paymentError = 'The payment could not be started. Your booking is saved — please retry payment or contact us.'
        }
      }
    }

    return Response.json({
      reference: booking.reference,
      bookingId: booking.id,
      accessToken: booking.accessToken,
      totals: { subtotalPaise: booking.subtotalPaise, discountPaise: booking.discountPaise, collectionFeePaise: booking.collectionFeePaise, totalPaise: booking.totalPaise },
      status: booking.status,
      payment,
      paymentError,
      confirmationUrl: `/booking/confirmation/${booking.reference}?t=${encodeURIComponent(booking.accessToken)}`,
      emailConfigured: emailConfigured(),
      paymentStatus: publicPaymentStatus(),
      settings: { brandName: settings.brandName, supportPhone: settings.supportPhone },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    if (error instanceof BookingError) return Response.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[booking] create failed', error)
    return Response.json({ error: 'The booking could not be completed. Please try again.' }, { status: 500 })
  }
}

/** Pricing preview for the review step. */
export async function PUT(request: Request) {
  try {
    const body = await parseJson(request, z.object({
      items: z.array(z.object({ kind: z.enum(['test', 'package']), id: z.number().int().positive(), quantity: z.number().int().min(1).max(5).default(1) })).min(1).max(12),
      method: z.enum(['home', 'lab']),
    }))
    const priced = await priceCart(body.items, body.method)
    return Response.json({
      lines: priced.lines,
      subtotalPaise: priced.subtotalPaise,
      discountPaise: priced.discountPaise,
      collectionFeePaise: priced.collectionFeePaise,
      totalPaise: priced.totalPaise,
    })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: 'Pricing could not be calculated.' }, { status: 500 })
  }
}
