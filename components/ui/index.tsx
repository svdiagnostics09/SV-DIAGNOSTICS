import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Small, reusable, accessible UI primitives shared by the site and console. */

export function Badge({ tone = 'gray', children, className }: { tone?: 'teal' | 'navy' | 'amber' | 'green' | 'red' | 'gray'; children: React.ReactNode; className?: string }) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>
}

export function SectionHeading({ eyebrow, title, description, action, className }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('motion-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 text-[1.4rem] font-bold leading-tight tracking-[-0.02em] sm:text-[1.7rem]">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'teal', href }: { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone?: 'teal' | 'navy' | 'amber' | 'green' | 'red' | 'violet'; href?: string }) {
  const tint: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700',
    navy: 'bg-[#e8eef8] text-navy',
    amber: 'bg-[#fef3c7] text-[#92400e]',
    green: 'bg-[#dcfce7] text-[#166534]',
    red: 'bg-[#fee2e2] text-[#991b1b]',
    violet: 'bg-[#ede9fe] text-[#5b21b6]',
  }
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tint[tone])}><Icon size={17} aria-hidden /></span>
      </div>
      <p className="mt-3 text-[1.65rem] font-bold leading-none tracking-tight text-navy tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-[12px] leading-4 text-muted">{hint}</p>}
    </>
  )
  return href
    ? <Link href={href} className="card card-interactive metric-card block p-4">{body}</Link>
    : <div className="card metric-card p-4">{body}</div>
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-line-soft text-muted"><Icon size={20} aria-hidden /></span>
      <p className="mt-3 text-sm font-semibold text-navy">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-semibold text-danger">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">{description}</p>}
      {onRetry && <button type="button" onClick={onRetry} className="btn btn-outline btn-sm mt-4">Try again</button>}
    </div>
  )
}

export function Skeletons({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={className ?? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card p-4">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton mt-3 h-5 w-4/5" />
          <div className="skeleton mt-2 h-3 w-2/3" />
          <div className="skeleton mt-5 h-7 w-24" />
        </div>
      ))}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[12.5px] text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden>/</span>}
            {item.href ? <Link href={item.href} className="hover:text-teal-700">{item.label}</Link> : <span className="text-ink">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function PageHeader({ title, description, breadcrumbs, children }: { title: string; description?: string; breadcrumbs?: Array<{ label: string; href?: string }>; children?: React.ReactNode }) {
  return (
    <div className="page-hero border-b border-line-soft">
      <div className="container-x py-7 sm:py-9">
        {breadcrumbs && <div className="motion-rise"><Breadcrumbs items={breadcrumbs} /></div>}
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="motion-rise motion-delay-1">
            <h1 className="text-[1.8rem] font-bold leading-tight tracking-[-0.025em] sm:text-[2.1rem]">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Rounded icon tile used across marketing sections. */
export function IconTile({ icon: Icon, tone = 'teal', size = 'md' }: { icon: LucideIcon; tone?: 'teal' | 'navy'; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center', size === 'sm' ? 'size-9 rounded-[10px]' : 'size-11 rounded-xl', tone === 'teal' ? 'bg-teal-50 text-teal-700' : 'bg-line-soft text-navy')}>
      <Icon size={size === 'sm' ? 17 : 21} aria-hidden />
    </span>
  )
}
