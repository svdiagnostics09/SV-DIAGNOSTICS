import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Text-based brand mark: an orange droplet-and-cross glyph beside the wordmark.
 * Stands in for official brand artwork, which is unavailable.
 */
export function Logo({ brandName, tagline, size = 'md', href = '/', logoUrl, className }: {
  brandName: string
  tagline?: string
  size?: 'sm' | 'md'
  href?: string | null
  /** Custom logo uploaded in Admin → Business settings. Falls back to the built-in mark. */
  logoUrl?: string
  className?: string
}) {
  const mark = (
    <span className={cn('flex items-center', size === 'sm' ? 'gap-2' : 'gap-2.5')}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads vary in aspect ratio
        <img src={logoUrl} alt={`${brandName} logo`} className={cn('shrink-0 object-contain', size === 'sm' ? 'size-8' : 'size-10')} />
      ) : (
        <span className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-[10px]', size === 'sm' ? 'size-8' : 'size-10')}>
        <svg viewBox="0 0 40 40" className="size-full" aria-hidden focusable="false">
          <rect width="40" height="40" rx="10" fill="#204F46" />
          <path d="M20 8c-4.4 5.1-8 9.3-8 13.4a8 8 0 0 0 16 0C28 17.3 24.4 13.1 20 8Z" fill="#FF9417" />
          <path d="M17.2 20.4h5.6M20 17.6v5.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="29" cy="11" r="4.2" fill="#00B98B" />
          <path d="M27.2 11h3.6M29 9.2v3.6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <b className={cn('block truncate font-bold tracking-[-0.02em] text-forest', size === 'sm' ? 'text-[15px]' : 'text-[17px]')}>{brandName}</b>
        {tagline && <span className={cn('block truncate font-medium text-muted', size === 'sm' ? 'text-[10px]' : 'text-[11px]')}>{tagline}</span>}
      </span>
    </span>
  )

  if (!href) return <span className={className}>{mark}</span>
  return (
    <Link href={href} className={cn('rounded-lg', className)} aria-label={`${brandName} home`}>
      {mark}
    </Link>
  )
}
