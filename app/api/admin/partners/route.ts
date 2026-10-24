import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { firstIssue } from '@/lib/validation'
import { createPartner, deletePartner, isUuid, listPartners, updatePartner } from '@/lib/partners'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter the partner name.').max(80),
  role: z.string().trim().max(60).optional().default(''),
  href: z.string().trim().max(300).optional().default(''),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
})

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.string().trim().max(60).optional(),
  href: z.string().trim().max(300).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
})

function refresh() {
  revalidatePath('/')
}

/** GET — every partner, ordered. */
export async function GET(request: Request) {
  try {
    await guard(request)
    return Response.json(await listPartners())
  } catch (error) {
    return jsonError(error)
  }
}

/** POST — create a partner (add the image separately via PUT ?id=). */
export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const body = createSchema.parse(await request.json().catch(() => null))
    const id = crypto.randomUUID()
    await createPartner({ id, ...body })
    await audit({ actor: admin, action: 'partner.create', entity: 'partners', entityId: id, detail: body, request })
    refresh()
    return Response.json({ id, ...body }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

/** PATCH ?id= — rename, reorder, deactivate. */
export async function PATCH(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = new URL(request.url).searchParams.get('id')
    if (!isUuid(id)) return Response.json({ error: 'Partner not found.' }, { status: 404 })
    const body = patchSchema.parse(await request.json().catch(() => null))
    await updatePartner(id, body)
    await audit({ actor: admin, action: 'partner.update', entity: 'partners', entityId: id, detail: body, request })
    refresh()
    return Response.json({ updated: true })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

/** DELETE ?id= — removes the partner and its image. */
export async function DELETE(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = new URL(request.url).searchParams.get('id')
    if (!isUuid(id)) return Response.json({ error: 'Partner not found.' }, { status: 404 })
    await deletePartner(id)
    await audit({ actor: admin, action: 'partner.delete', entity: 'partners', entityId: id, request })
    refresh()
    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error)
  }
}
