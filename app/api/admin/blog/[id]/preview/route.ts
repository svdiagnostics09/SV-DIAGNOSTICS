import { guard, jsonError } from '@/lib/auth'
import { getBlogPost, listBlogPosts } from '@/lib/content'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await guard(request)
    const list = await listBlogPosts(true)
    const { id } = await context.params
    const row = list.find((post) => post.id === Number(id))
    if (!row) return Response.json({ error: 'Post not found.' }, { status: 404 })
    const full = await getBlogPost(row.slug, true)
    return Response.json({ ...full, id: row.id })
  } catch (error) {
    return jsonError(error)
  }
}
