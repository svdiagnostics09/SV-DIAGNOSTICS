import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listServiceAreas } from '@/lib/network'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the area name.').max(80),
  city: z.string().trim().max(60).optional().default('Hyderabad'),
  pincodes: z.array(z.string().trim().regex(/^[1-9]\d{5}$/, 'Pincodes must be 6 digits.')).min(1, 'Add at least one pincode.').max(200),
  homeCollection: z.boolean().optional().default(true),
  collectionFeePaise: z.number().int().min(0).max(100000).optional().default(0),
  operatingHours: z.string().trim().max(160).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

const handlers = resourceHandlers({
  table: 'service_areas',
  entity: 'service_area',
  schema,
  list: (includeInactive): Promise<Record<string, unknown>[]> => listServiceAreas(includeInactive).then((rows) => rows as unknown as Record<string, unknown>[]),
  columns: { name: 'name', city: 'city', pincodes: 'pincodes', homeCollection: 'home_collection', collectionFeePaise: 'collection_fee_paise', operatingHours: 'operating_hours', isActive: 'is_active' },
  paths: ['/', '/service-areas', '/home-collection'],
  deleteGuard: async (id) => {
    const { one } = await import('@/lib/db')
    const used = await one<{ n: number }>('SELECT count(*)::int AS n FROM bookings WHERE service_area_id = $1', [id])
    return used && used.n > 0 ? `This area is used by ${used.n} booking(s). Deactivate it instead of deleting.` : null
  },
})

export async function GET(request: Request) { return handlers.GET(request) }
export async function POST(request: Request) { return handlers.POST(request) }
