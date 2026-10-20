import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listBlogPosts } from '@/lib/content'

export const dynamic = 'force-dynamic'

export const blogSchema = z.object({
  title: z.string().trim().min(4, 'Enter a title.').max(200),
  excerpt: z.string().max(500).optional().default(''),
  body: z.string().max(60000).optional().default(''),
  coverImageUrl: z.string().max(600).optional().default(''),
  author: z.string().trim().max(80).optional().default('SV Diagnostics'),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
})

const handlers = resourceHandlers({
  table: 'blog_posts',
  entity: 'blog_post',
  schema: blogSchema,
  list: (includeInactive): Promise<Record<string, unknown>[]> => listBlogPosts(includeInactive).then((rows) => rows as unknown as Record<string, unknown>[]),
  columns: { title: 'title', excerpt: 'excerpt', body: 'body', coverImageUrl: 'cover_image_url', author: 'author', status: 'status' },
  slugFrom: 'title',
  paths: ['/blog'],
})

/** Publishing sets published_at the first time; unpublishing keeps the date. */
const originalPatch = handlers.PATCH

export async function GET(request: Request) { return handlers.GET(request) }

export async function POST(request: Request) {
  const clone = request.clone()
  const body = await clone.json().catch(() => ({})) as { status?: string }
  const { sql } = await import('@/lib/db')
  const response = await handlers.POST(request)
  if (response.ok && body.status === 'published') {
    const created = await response.clone().json().catch(() => ({})) as { id?: number }
    if (created.id) await sql(`UPDATE blog_posts SET published_at = now() WHERE id = $1 AND published_at IS NULL`, [created.id])
  }
  return response
}
