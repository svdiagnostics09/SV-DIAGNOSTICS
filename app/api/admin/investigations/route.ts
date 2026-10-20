import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listInvestigations } from '@/lib/catalogue'
import { one } from '@/lib/db'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the investigation name.').max(120),
  description: z.string().max(2000).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

const handlers = resourceHandlers({
  table: 'investigations',
  entity: 'investigation',
  schema,
  list: (includeInactive) => listInvestigations(includeInactive),
  columns: { name: 'name', description: 'description', isActive: 'is_active' },
  paths: ['/', '/tests'],
  deleteGuard: async (id) => {
    const used = await one<{ n: number }>('SELECT count(*)::int AS n FROM test_investigations WHERE investigation_id = $1', [id])
    return used && used.n > 0 ? `This investigation is linked to ${used.n} test(s). Unlink it first, or deactivate it.` : null
  },
})

export async function GET(request: Request) { return handlers.GET(request) }
export async function POST(request: Request) { return handlers.POST(request) }
