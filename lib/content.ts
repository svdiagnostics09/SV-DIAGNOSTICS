import { one, sql } from '@/lib/db'

/** Banners, FAQs, blog posts and enquiry intake — all database-backed. */

export interface Banner {
  id: number
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
  imageUrl: string
  placement: 'home' | 'catalogue' | 'packages'
  sortOrder: number
  isPublished: boolean
}

const mapBanner = (row: Record<string, unknown>): Banner => ({
  id: Number(row.id),
  title: String(row.title),
  subtitle: String(row.subtitle ?? ''),
  ctaLabel: String(row.cta_label ?? ''),
  ctaHref: String(row.cta_href ?? ''),
  imageUrl: String(row.image_url ?? ''),
  placement: String(row.placement) as Banner['placement'],
  sortOrder: Number(row.sort_order ?? 0),
  isPublished: Boolean(row.is_published),
})

export async function listBanners(options: { includeDrafts?: boolean; placement?: Banner['placement'] } = {}) {
  const where: string[] = []
  const values: unknown[] = []
  if (!options.includeDrafts) where.push('is_published = true')
  if (options.placement) {
    values.push(options.placement)
    where.push(`placement = $${values.length}`)
  }
  const rows = await sql(`SELECT * FROM banners ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY sort_order, id`, values)
  return rows.map(mapBanner)
}

export interface Faq {
  id: number
  question: string
  answer: string
  category: string
  sortOrder: number
  isPublished: boolean
}

const mapFaq = (row: Record<string, unknown>): Faq => ({
  id: Number(row.id),
  question: String(row.question),
  answer: String(row.answer),
  category: String(row.category ?? 'General'),
  sortOrder: Number(row.sort_order ?? 0),
  isPublished: Boolean(row.is_published),
})

export async function listFaqs(includeDrafts = false) {
  const rows = await sql(`SELECT * FROM faqs ${includeDrafts ? '' : 'WHERE is_published = true'} ORDER BY sort_order, id`)
  return rows.map(mapFaq)
}

export interface BlogPostSummary {
  id: number
  title: string
  slug: string
  excerpt: string
  coverImageUrl: string
  author: string
  status: 'draft' | 'published' | 'archived'
  publishedAt: string | null
  updatedAt: string
}

const mapPost = (row: Record<string, unknown>): BlogPostSummary => ({
  id: Number(row.id),
  title: String(row.title),
  slug: String(row.slug),
  excerpt: String(row.excerpt ?? ''),
  coverImageUrl: String(row.cover_image_url ?? ''),
  author: String(row.author ?? ''),
  status: String(row.status) as BlogPostSummary['status'],
  publishedAt: row.published_at ? new Date(row.published_at as string).toISOString() : null,
  updatedAt: new Date(row.updated_at as string).toISOString(),
})

export async function listBlogPosts(includeDrafts = false) {
  const rows = await sql(
    `SELECT id, title, slug, excerpt, cover_image_url, author, status, published_at, updated_at FROM blog_posts
     ${includeDrafts ? '' : "WHERE status = 'published' AND published_at <= now()"}
     ORDER BY COALESCE(published_at, created_at) DESC`,
  )
  return rows.map(mapPost)
}

export async function getBlogPost(slug: string, includeDrafts = false) {
  const row = await one(
    `SELECT * FROM blog_posts WHERE slug = $1 ${includeDrafts ? '' : "AND status = 'published' AND published_at <= now()"}`,
    [slug],
  )
  if (!row) return null
  return { ...mapPost(row), body: String(row.body ?? '') }
}

export interface Enquiry {
  id: string
  reference: string
  name: string
  phone: string
  email: string
  subject: string
  message: string
  status: 'new' | 'in_progress' | 'resolved' | 'archived'
  internalNote: string
  createdAt: string
  updatedAt: string
}

const mapEnquiry = (row: Record<string, unknown>): Enquiry => ({
  id: String(row.id),
  reference: String(row.reference),
  name: String(row.name),
  phone: String(row.phone),
  email: String(row.email ?? ''),
  subject: String(row.subject ?? ''),
  message: String(row.message),
  status: String(row.status) as Enquiry['status'],
  internalNote: String(row.internal_note ?? ''),
  createdAt: new Date(row.created_at as string).toISOString(),
  updatedAt: new Date(row.updated_at as string).toISOString(),
})

export async function listEnquiries(limit = 200) {
  const rows = await sql('SELECT * FROM enquiries ORDER BY created_at DESC LIMIT $1', [limit])
  return rows.map(mapEnquiry)
}

export async function createEnquiry(input: { name: string; phone: string; email?: string; subject?: string; message: string }) {
  const reference = `ENQ-${Date.now().toString(36).toUpperCase()}`
  const row = await one(
    `INSERT INTO enquiries (reference, name, phone, email, subject, message) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [reference, input.name, input.phone, input.email ?? '', input.subject ?? '', input.message],
  )
  return mapEnquiry(row!)
}
