import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listLocations } from '@/lib/network'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(5).max(200),
  addressLine2: z.string().max(200).optional().default(''),
  area: z.string().trim().max(80).optional().default(''),
  city: z.string().trim().max(60).optional().default('Hyderabad'),
  state: z.string().trim().max(60).optional().default('Telangana'),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/).or(z.literal('')).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  email: z.string().trim().email().or(z.literal('')).optional().default(''),
  mapsUrl: z.string().trim().max(500).optional().default(''),
  openingHours: z.string().trim().max(160).optional().default(''),
  services: z.array(z.string().trim().max(60)).max(20).optional().default([]),
  isActive: z.boolean().optional().default(true),
})

const handlers = resourceHandlers({
  table: 'locations',
  entity: 'location',
  schema,
  list: (includeInactive): Promise<Record<string, unknown>[]> => listLocations(includeInactive).then((rows) => rows as unknown as Record<string, unknown>[]),
  columns: {
    name: 'name', addressLine1: 'address_line1', addressLine2: 'address_line2', area: 'area', city: 'city', state: 'state',
    pincode: 'pincode', phone: 'phone', email: 'email', mapsUrl: 'maps_url', openingHours: 'opening_hours', services: 'services', isActive: 'is_active',
  },
  slugFrom: 'name',
  paths: ['/', '/locations', '/service-areas'],
})

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return handlers.PATCH(request, Number((await context.params).id)) }
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return handlers.DELETE(request, Number((await context.params).id)) }
