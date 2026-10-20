import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listBanners } from '@/lib/content'

export const dynamic = 'force-dynamic'

const schema = z.object({
  title: z.string().trim().min(2, 'Enter a banner title.').max(120),
  subtitle: z.string().max(240).optional().default(''),
  ctaLabel: z.string().max(40).optional().default(''),
  ctaHref: z.string().max(300).optional().default(''),
  imageUrl: z.string().max(600).optional().default(''),
  placement: z.enum(['home', 'catalogue', 'packages']).optional().default('home'),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
  isPublished: z.boolean().optional().default(false),
})

const config = {
  table: 'banners',
  entity: 'banner',
  schema,
  list: (includeInactive: boolean): Promise<Record<string, unknown>[]> => listBanners({ includeDrafts: includeInactive }).then((rows) => rows as unknown as Record<string, unknown>[]),
  columns: { title: 'title', subtitle: 'subtitle', ctaLabel: 'cta_label', ctaHref: 'cta_href', imageUrl: 'image_url', placement: 'placement', sortOrder: 'sort_order', isPublished: 'is_published' },
  paths: ['/'],
}

const handlers = resourceHandlers(config)

export async function GET(request: Request) { return handlers.GET(request) }
export async function POST(request: Request) { return handlers.POST(request) }
