import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { getSettings, publicSettings, saveSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 1.5 * 1024 * 1024 // 1.5 MB — plenty for a logo or icon

/**
 * Accepted types are checked by magic bytes, not by the declared MIME type,
 * because the client controls that header.
 */
const SIGNATURES: Array<{ ext: string; test: (bytes: Uint8Array) => boolean }> = [
  { ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { ext: 'svg', test: (b) => new TextDecoder().decode(b.slice(0, 256)).toLowerCase().includes('<svg') },
  { ext: 'ico', test: (b) => b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00 },
]

const ASSETS = {
  logo: { field: 'logoUrl', folder: 'logo' },
  favicon: { field: 'faviconUrl', folder: 'favicon' },
} as const

/** POST multipart/form-data: { kind: 'logo' | 'favicon', file: File } */
export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })

    const form = await request.formData().catch(() => null)
    const kind = form?.get('kind')
    const file = form?.get('file')
    if (!form || (kind !== 'logo' && kind !== 'favicon') || !(file instanceof File)) {
      return Response.json({ error: 'Send a "kind" (logo or favicon) and a file.' }, { status: 400 })
    }
    if (file.size === 0) return Response.json({ error: 'The file is empty.' }, { status: 400 })
    if (file.size > MAX_BYTES) return Response.json({ error: 'That file is larger than 1.5 MB. Please compress it first.' }, { status: 400 })

    const bytes = new Uint8Array(await file.arrayBuffer())
    const signature = SIGNATURES.find((entry) => entry.test(bytes))
    if (!signature) {
      return Response.json({ error: 'Use a PNG, JPG, WebP, SVG or ICO file.' }, { status: 400 })
    }
    // SVG can carry script. Only accept it when it does not.
    if (signature.ext === 'svg') {
      const text = new TextDecoder().decode(bytes).toLowerCase()
      if (text.includes('<script') || text.includes('javascript:') || text.includes('onload=') || text.includes('onerror=')) {
        return Response.json({ error: 'That SVG contains script and was rejected. Export it as a plain image instead.' }, { status: 400 })
      }
    }

    const asset = ASSETS[kind]
    const fileName = `${asset.folder}-${randomUUID().slice(0, 12)}.${signature.ext}`
    const directory = path.join(process.cwd(), 'public', 'uploads', 'brand')
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, fileName), bytes)

    const url = `/uploads/brand/${fileName}`
    const current = await getSettings()
    await saveSettings({ ...current, [asset.field]: url })
    await audit({ actor: admin, action: `settings.upload_${kind}`, entity: 'business_settings', detail: { url }, request })
    revalidatePath('/', 'layout')

    return Response.json({ url, settings: publicSettings(await getSettings()) })
  } catch (error) {
    return jsonError(error)
  }
}

/** DELETE ?kind=logo|favicon — clears the override and falls back to the built-in mark. */
export async function DELETE(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const kind = new URL(request.url).searchParams.get('kind')
    if (kind !== 'logo' && kind !== 'favicon') return Response.json({ error: 'Unknown asset.' }, { status: 400 })
    const asset = ASSETS[kind]
    const current = await getSettings()
    await saveSettings({ ...current, [asset.field]: '' })
    await audit({ actor: admin, action: `settings.reset_${kind}`, entity: 'business_settings', request })
    revalidatePath('/', 'layout')
    return Response.json({ settings: publicSettings(await getSettings()) })
  } catch (error) {
    return jsonError(error)
  }
}
