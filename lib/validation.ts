import { z } from 'zod'

/** Shared validation helpers — every API body is parsed with these. */

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => /^(\+91)?[6-9]\d{9}$/.test(value), 'Enter a valid 10-digit Indian mobile number.')
  .transform((value) => (value.startsWith('+91') ? value.slice(3) : value))

export const pincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode.')

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.')

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Please enter a full name.')
  .max(80, 'Name is too long.')
  .regex(/^[\p{L}\p{M} .'\-0-9]+$/u, 'Name can only contain letters, numbers, spaces, apostrophes and hyphens.')

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'item'

/** Rupees entered in the admin UI → integer paise. */
export const rupeesToPaise = z
  .number()
  .int('Enter the amount in paise.')
  .min(0, 'Enter a valid amount.')

export const discountSchema = z
  .object({
    discountType: z.enum(['none', 'percent', 'amount']).default('none'),
    discountValue: z.coerce.number().int().min(0).default(0),
  })
  .refine((value) => value.discountType !== 'percent' || (value.discountValue >= 1 && value.discountValue <= 100), {
    message: 'Percentage discount must be between 1 and 100.',
    path: ['discountValue'],
  })

export const idSchema = z.coerce.number().int().positive()

/** First readable message from a ZodError. */
export function firstIssue(error: z.ZodError) {
  const issue = error.issues[0]
  return issue ? issue.message : 'Invalid input.'
}

/** Parse a JSON body against a schema; throws a ZodError the route maps to 400. */
export async function parseJson<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  const body = await request.json().catch(() => null)
  return schema.parse(body)
}

export const emptyToNull = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
