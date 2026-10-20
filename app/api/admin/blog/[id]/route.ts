import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listBlogPosts } from '@/lib/content'

export const dynamic = 'force-dynamic'

const schema = z.object({
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
  schema,
  list: (includeInactive): Promise<Record<string, unknown>[]> => listBlogPosts(includeInactive).then((rows) => rows as unknown as Record<string, unknown>[]),
  columns: { title: 'title', excerpt: 'excerpt', body: 'body', coverImageUrl: 'cover_image_url', author: 'author', status: 'status' },
  slugFrom: 'title',
  paths: ['/blog'],
})

export async function GET(request: Request) { return handlers.GET(request) }

export async function POST(request: Request) {
  const { status } = await request.clone().json().catch(() => ({})) as { status?: string }
  const response = await handlers.POST(request)
  if (response.ok && status === 'published') {
    const created = await response.clone().json().catch(() => ({})) as { id?: number }
    if (created.id) {
      const { sql } = await import('@/lib/db')
      await sql(`UPDATE blog_posts SET published_at = now() WHERE id = $1 AND published_at IS NULL`, [created.id])
    }
  }
  return response
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { status } = await request.clone().json().catch(() => ({})) as { status?: string }
  const response = await handlers.PATCH(request, Number(id))
  if (response.ok && status === 'published') {
    const { sql } = await import('@/lib/db')
    await sql(`UPDATE blog_posts SET published_at = COALESCE(published_at, now()) WHERE id = $1`, [Number(id)])
  }
  return response
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return handlers.DELETE(request, Number((await context.params).id)) }
