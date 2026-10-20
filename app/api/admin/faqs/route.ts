import { z } from 'zod'
import { resourceHandlers } from '@/lib/admin-resource'
import { listFaqs } from '@/lib/content'

export const dynamic = 'force-dynamic'

const schema = z.object({
  question: z.string().trim().min(5, 'Enter the question.').max(300),
  answer: z.string().trim().min(5, 'Enter the answer.').max(4000),
  category: z.string().trim().max(60).optional().default('General'),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
  isPublished: z.boolean().optional().default(true),
})

const handlers = resourceHandlers({
  table: 'faqs',
  entity: 'faq',
  schema,
  list: (includeInactive): Promise<Record<string, unknown>[]> => listFaqs(includeInactive).then((rows) => rows as unknown as Record<string, unknown>[]),
  columns: { question: 'question', answer: 'answer', category: 'category', sortOrder: 'sort_order', isPublished: 'is_published' },
  paths: ['/', '/faq'],
})

export async function GET(request: Request) { return handlers.GET(request) }
export async function POST(request: Request) { return handlers.POST(request) }
