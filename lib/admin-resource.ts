import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue, slugify } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type Admin = Awaited<ReturnType<typeof guard>>
type Row = Record<string, unknown>

export interface ResourceConfig {
  table: string
  entity: string
  /** Body schema; all fields optional on PATCH. */
  schema: z.ZodObject<z.ZodRawShape>
  list: (includeInactive: boolean) => Promise<Row[]>
  /** Columns explicitly copied from the parsed body. */
  columns: Record<string, string>
  /** Column recomputed from other fields on write. */
  derive?: (merged: Row) => Row
  /** Columns that must not be updated (immutable). */
  immutable?: string[]
  /** Paths to revalidate after a change. */
  paths?: string[]
  /** Return an error message when a delete must be refused. */
  deleteGuard?: (id: number, admin: Admin) => Promise<string | null>
  slugFrom?: string
}

const toSnake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

export function resourceHandlers(config: ResourceConfig) {
  const label = config.entity

  const paths = () => { for (const path of config.paths ?? ['/']) revalidatePath(path) }

  const GET = async (request: Request) => {
    try {
      await guard(request)
      const includeInactive = new URL(request.url).searchParams.get('all') === '1'
      return Response.json(await config.list(includeInactive))
    } catch (error) {
      return jsonError(error)
    }
  }

  const POST = async (request: Request) => {
    try {
      const admin = await guard(request, { mutation: true })
      const body = config.schema.parse(await request.json().catch(() => null)) as Record<string, unknown>
      const entry: Record<string, unknown> = { ...body }
      if (config.slugFrom && !entry.slug && typeof entry[config.slugFrom] === 'string') {
        entry.slug = slugify(entry[config.slugFrom] as string)
      }
      const columns: string[] = []
      const placeholders: string[] = []
      const values: unknown[] = []
      for (const [key, column] of Object.entries(config.columns)) {
        if (entry[key] === undefined) continue
        values.push(entry[key]); columns.push(column); placeholders.push(`$${values.length}`)
      }
      if (config.slugFrom && entry.slug) {
        for (let suffix = 2; await one(`SELECT 1 FROM ${config.table} WHERE ${config.slugFrom === 'name' ? 'slug' : 'slug'} = $1`, [`${entry.slug}`]); suffix += 1) {
          entry.slug = `${slugify(String(entry[config.slugFrom]))}-${suffix}`
        }
        if (!columns.includes('slug')) { values.push(entry.slug); columns.push('slug'); placeholders.push(`$${values.length}`) }
        else values[columns.indexOf('slug')] = entry.slug
      }
      const row = await one<{ id: number }>(`INSERT INTO ${config.table} (${columns.join(',')}) VALUES (${placeholders.join(',')}) RETURNING id`, values)
      await audit({ actor: admin, action: `${label}.create`, entity: config.table, entityId: String(row?.id), detail: body, request })
      paths()
      return Response.json({ id: row?.id, ...entry }, { status: 201 })
    } catch (error) {
      if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
      if ((error as { code?: string }).code === '23505') return Response.json({ error: 'That name or slug already exists.' }, { status: 409 })
      return jsonError(error)
    }
  }

  const PATCH = async (request: Request, id: number) => {
    try {
      const admin = await guard(request, { mutation: true })
      const body = config.schema.partial().parse(await request.json().catch(() => null)) as Record<string, unknown>
      const current = await one<Row>(`SELECT * FROM ${config.table} WHERE id = $1`, [id])
      if (!current) return Response.json({ error: `${label} not found.` }, { status: 404 })
      const merged: Record<string, unknown> = { ...body }
      for (const key of config.immutable ?? []) delete merged[key]
      if (config.derive) Object.assign(merged, config.derive({ ...current, ...merged }))
      const sets: string[] = []
      const values: unknown[] = []
      for (const [key, column] of Object.entries(config.columns)) {
        if (merged[key] === undefined) continue
        values.push(merged[key]); sets.push(`${column} = $${values.length}`)
      }
      if ('updated_at' in current) sets.push('updated_at = now()')
      if (sets.length) {
        values.push(id)
        await sql(`UPDATE ${config.table} SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
      }
      await audit({ actor: admin, action: `${label}.update`, entity: config.table, entityId: String(id), detail: Object.keys(merged), request })
      paths()
      return Response.json(await one(`SELECT * FROM ${config.table} WHERE id = $1`, [id]))
    } catch (error) {
      if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
      if ((error as { code?: string }).code === '23505') return Response.json({ error: 'That name or slug already exists.' }, { status: 409 })
      return jsonError(error)
    }
  }

  const DELETE = async (request: Request, id: number) => {
    try {
      const admin = await guard(request, { mutation: true })
      const refusal = config.deleteGuard ? await config.deleteGuard(id, admin) : null
      if (refusal) return Response.json({ error: refusal }, { status: 409 })
      await sql(`DELETE FROM ${config.table} WHERE id = $1`, [id])
      await audit({ actor: admin, action: `${label}.delete`, entity: config.table, entityId: String(id), request })
      paths()
      return Response.json({ deleted: true })
    } catch (error) {
      if ((error as { code?: string }).code === '23503') return Response.json({ error: 'This record is still referenced and cannot be deleted. Archive it instead.' }, { status: 409 })
      return jsonError(error)
    }
  }

  return { GET, POST, PATCH, DELETE, toSnake }
}
