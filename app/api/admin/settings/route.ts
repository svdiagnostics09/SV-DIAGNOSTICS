import { revalidatePath } from 'next/cache'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { one, sql } from '@/lib/db'
import { getSettings, publicSettings, saveSettings, settingsSchema } from '@/lib/settings'
import { emailSchema, firstIssue } from '@/lib/validation'
import { whatsappConfigured } from '@/lib/notify'
import { z, ZodError } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await guard(request)
    const settings = await getSettings()
    const admins = await sql<{ id: string; email: string; name: string; role: string; is_active: boolean; last_login_at: Date | null }>(
      'SELECT id, email, name, role, is_active, last_login_at FROM users ORDER BY created_at',
    )
    return Response.json({
      // The report-delivery preferences are admin-only, so they are appended to
      // the public shape rather than added to `publicSettings`.
      settings: {
        ...publicSettings(settings),
        whatsappReportsEnabled: settings.whatsappReportsEnabled,
        whatsappTemplateName: settings.whatsappTemplateName,
        whatsappTemplateLanguage: settings.whatsappTemplateLanguage,
        whatsappTemplateParam: settings.whatsappTemplateParam,
      },
      internal: { bookingHorizonDays: settings.bookingHorizonDays, slotHoldMinutes: settings.slotHoldMinutes, whatsappConfigured: whatsappConfigured() },
      admins: admins.map((row) => ({ id: row.id, email: row.email, name: row.name, role: row.role, isActive: row.is_active, lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null })),
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const body = settingsSchema.partial().parse(await request.json().catch(() => null))
    const settings = await saveSettings(body)
    await audit({ actor: admin, action: 'settings.update', entity: 'business_settings', detail: Object.keys(body), request })
    revalidatePath('/', 'layout')
    return Response.json({ settings: publicSettings(settings) })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

/* Account management --------------------------------------------------- */

const accountSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('profile'), name: z.string().trim().min(2).max(80), email: emailSchema }),
  z.object({ action: z.literal('password'), currentPassword: z.string().min(1), newPassword: z.string().min(10, 'Use at least 10 characters.') }),
  z.object({ action: z.literal('create_admin'), email: emailSchema, name: z.string().trim().min(2).max(80), password: z.string().min(10, 'Use at least 10 characters.'), role: z.enum(['admin', 'owner']).default('admin') }),
  z.object({ action: z.literal('toggle_admin'), userId: z.string().uuid(), isActive: z.boolean() }),
])

export async function PUT(request: Request) {
  try {
    const admin = await guard(request, { mutation: true, owner: true })
    const body = accountSchema.parse(await request.json().catch(() => null))
    if (body.action === 'profile') {
      await sql('UPDATE users SET name = $2, email = $3, updated_at = now() WHERE id = $1', [admin.id, body.name, body.email])
    } else if (body.action === 'password') {
      const row = await one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [admin.id])
      if (!row || !verifyPassword(body.currentPassword, row.password_hash)) return Response.json({ error: 'Current password is incorrect.' }, { status: 400 })
      await sql('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [admin.id, hashPassword(body.newPassword)])
      await sql('DELETE FROM sessions WHERE user_id = $1', [admin.id])
    } else if (body.action === 'create_admin') {
      const existing = await one('SELECT 1 FROM users WHERE lower(email) = lower($1)', [body.email])
      if (existing) return Response.json({ error: 'An account with that email already exists.' }, { status: 409 })
      await sql('INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4)', [body.email, body.name, hashPassword(body.password), body.role])
    } else if (body.action === 'toggle_admin') {
      if (body.userId === admin.id) return Response.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
      await sql('UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1', [body.userId, body.isActive])
      if (!body.isActive) await sql('DELETE FROM sessions WHERE user_id = $1', [body.userId])
    }
    await audit({ actor: admin, action: `account.${body.action}`, entity: 'users', entityId: 'userId' in body ? body.userId : admin.id, request })
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}
