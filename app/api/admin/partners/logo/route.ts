import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { findPartner, isUuid, putPartnerLogo } from '@/lib/partners'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 1.5 * 1024 * 1024 // 1.5 MB — same ceiling as the brand logo

/**
 * Accepted types are checked by magic bytes, not the declared MIME type,
 * because the client controls that header.
 */
const SIGNATURES: Array<{ ext: string; test: (bytes: Uint8Array) => boolean }> = [
  { ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { ext: 'svg', test: (b) => new TextDecoder().decode(b.slice(0, 256)).toLowerCase().includes('<svg') },
]

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

/** POST multipart/form-data: { id, file } — replaces that partner's image. */
export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })

    const form = await request.formData().catch(() => null)
    const id = form?.get('id')
    const file = form?.get('file')
    if (!form || !isUuid(id) || !(file instanceof File)) {
      return Response.json({ error: 'Send a partner "id" and a file.' }, { status: 400 })
    }
    if (!(await findPartner(id))) return Response.json({ error: 'Partner not found.' }, { status: 404 })
    if (file.size === 0) return Response.json({ error: 'The file is empty.' }, { status: 400 })
    if (file.size > MAX_BYTES) return Response.json({ error: 'That file is larger than 1.5 MB. Please compress it first.' }, { status: 400 })

    const bytes = new Uint8Array(await file.arrayBuffer())
    const signature = SIGNATURES.find((entry) => entry.test(bytes))
    if (!signature) return Response.json({ error: 'Use a PNG, JPG, WebP or SVG file.' }, { status: 400 })
    // SVG can carry script. Only accept it when it does not.
    if (signature.ext === 'svg') {
      const text = new TextDecoder().decode(bytes).toLowerCase()
      if (text.includes('<script') || text.includes('javascript:') || text.includes('onload=') || text.includes('onerror=')) {
        return Response.json({ error: 'That SVG contains script and was rejected. Export it as a plain image instead.' }, { status: 400 })
      }
    }

    // A fresh logo id each time, so the URL changes and no cache shows the old
    // image. The previous row is deleted by putPartnerLogo().
    const logoId = randomUUID()
    await putPartnerLogo({
      partnerId: id,
      logoId,
      fileName: `partner-${logoId.slice(0, 8)}.${signature.ext}`,
      mimeType: MIME[signature.ext],
      bytes,
      actorEmail: admin.email,
    })
    await audit({ actor: admin, action: 'partner.upload_logo', entity: 'partners', entityId: id, request })
    revalidatePath('/')

    return Response.json({ logoUrl: `/api/partners/${logoId}?v=${Date.now()}` })
  } catch (error) {
    return jsonError(error)
  }
}
