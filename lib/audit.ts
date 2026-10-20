import type { AdminUser } from '@/lib/auth'
import { ipHash } from '@/lib/auth'
import { sql } from '@/lib/db'

/** Append-only audit trail for sensitive operations. Never throws. */
export async function audit(input: {
  actor?: AdminUser | null
  action: string
  entity: string
  entityId?: string | number | null
  detail?: Record<string, unknown> | unknown[]
  request?: Request
}) {
  try {
    await sql(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity, entity_id, detail, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        input.actor?.id ?? null,
        input.actor?.email ?? '',
        input.action,
        input.entity,
        String(input.entityId ?? ''),
        JSON.stringify(input.detail ?? {}),
        input.request ? ipHash(input.request) : '',
      ],
    )
  } catch (error) {
    console.error('[audit] failed to write entry', (error as Error).message)
  }
}

export async function listAuditLogs(limit = 200) {
  const rows = await sql(
    `SELECT id, actor_email, action, entity, entity_id, detail, created_at FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
    [Math.min(500, limit)],
  )
  return rows.map((row) => ({
    id: Number(row.id),
    actor: String(row.actor_email || 'system'),
    action: String(row.action),
    entity: String(row.entity),
    entityId: String(row.entity_id ?? ''),
    detail: row.detail as Record<string, unknown>,
    at: new Date(row.created_at as string).toISOString(),
  }))
}
