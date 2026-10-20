import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listCategories } from '@/lib/catalogue'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a category name.').max(80),
  description: z.string().max(1000).optional().default(''),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
})

const handlers = resourceHandlers({
  table: 'diagnostic_categories',
  entity: 'category',
  schema,
  list: (includeInactive) => listCategories(includeInactive),
  columns: { name: 'name', description: 'description', sortOrder: 'sort_order', isActive: 'is_active' },
  slugFrom: 'name',
  paths: ['/', '/tests', '/price-list'],
  deleteGuard: async (id) => {
    const { one } = await import('@/lib/db')
    const used = await one<{ n: number }>('SELECT count(*)::int AS n FROM diagnostic_tests WHERE category_id = $1', [id])
    return used && used.n > 0 ? `This category is used by ${used.n} test(s). Move them to another category or deactivate it instead.` : null
  },
})

export async function GET(request: Request) { return handlers.GET(request) }
export async function POST(request: Request) { return handlers.POST(request) }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return handlers.PATCH(request, Number((await context.params).id)) }
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return handlers.DELETE(request, Number((await context.params).id)) }
