import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Newspaper } from 'lucide-react'
import { listBlogPosts } from '@/lib/content'
import { formatIndiaTime } from '@/lib/db'
import { siteShell } from '@/lib/page-data'
import { SiteShell } from '@/components/site/site-shell'
import { PageHeader, EmptyState } from '@/components/ui'

export const metadata: Metadata = { title: 'Health Articles', description: 'Articles published by SV Diagnostics.' }
export const revalidate = 300

export default async function BlogPage() {
  const [{ settings }, posts] = await Promise.all([siteShell(), listBlogPosts()])
  return (
    <SiteShell settings={settings}>
      <PageHeader title="Health Articles" description="Guidance and updates published by our team." breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Blog' }]} />
      <div className="container-x py-8">
        {posts.length === 0 ? (
          <div className="card"><EmptyState icon={Newspaper} title="No articles published yet" description="Articles will appear here once they are written and published." /></div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="card flex flex-col overflow-hidden transition hover:shadow-card">
                {post.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.coverImageUrl} alt="" className="h-40 w-full object-cover" loading="lazy" />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[11.5px] text-muted">{post.publishedAt ? formatIndiaTime(post.publishedAt, { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {post.author}</p>
                  <h2 className="mt-1 text-[16px] font-bold leading-snug"><Link href={`/blog/${post.slug}`} className="hover:text-teal-700">{post.title}</Link></h2>
                  <p className="mt-1.5 line-clamp-3 text-[13px] leading-6 text-muted">{post.excerpt}</p>
                  <Link href={`/blog/${post.slug}`} className="mt-auto inline-flex items-center gap-1 pt-4 text-[12.5px] font-semibold text-teal-700 hover:underline">Read article <ArrowRight size={13} aria-hidden /></Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
