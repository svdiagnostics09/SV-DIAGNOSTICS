import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBlogPost, listBlogPosts } from '@/lib/content'
import { formatIndiaTime } from '@/lib/db'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { Breadcrumbs } from '@/components/ui'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug)
  return post ? { title: post.title, description: post.excerpt } : { title: 'Article not found' }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [post, { settings }] = await Promise.all([getBlogPost(slug), siteShell()])
  if (!post) notFound()
  const others = (await listBlogPosts()).filter((item) => item.slug !== slug).slice(0, 3)

  return (
    <SiteShell settings={settings}>
      <article className="container-x max-w-3xl py-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Blog', href: '/blog' }, { label: post.title }]} />
        <header className="mt-4">
          <p className="text-[12px] text-muted">{post.publishedAt ? formatIndiaTime(post.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' }) : ''} · {post.author}</p>
          <h1 className="mt-2 text-[1.8rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2.2rem]">{post.title}</h1>
          {post.excerpt && <p className="mt-3 text-[15px] leading-7 text-muted">{post.excerpt}</p>}
        </header>
        {post.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="mt-6 w-full rounded-xl border border-line object-cover" />
        )}
        <div className="prose-sv mt-6 whitespace-pre-line text-[14.5px] leading-8 text-ink">{post.body}</div>
        <p className="mt-8 rounded-lg border border-line bg-white p-4 text-[12px] leading-5 text-muted">This article is general health information, not medical advice. Discuss your results and treatment with a qualified doctor.</p>
        {others.length > 0 && (
          <section className="mt-10 border-t border-line pt-6">
            <h2 className="text-[14px] font-bold uppercase tracking-[0.08em] text-muted">More articles</h2>
            <ul className="mt-3 space-y-2">
              {others.map((item) => <li key={item.id}><Link href={`/blog/${item.slug}`} className="text-[14px] font-semibold text-navy hover:text-teal-700">{item.title}</Link></li>)}
            </ul>
          </section>
        )}
      </article>
    </SiteShell>
  )
}
