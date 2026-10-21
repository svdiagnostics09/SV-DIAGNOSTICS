'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Accessible overlay used by the cart drawer, product details and booking
 * dialogs: portalled, scroll-locked, Escape to close, focus moved in on open
 * and returned to the trigger on close, with Tab cycling inside.
 */
export function Overlay({
  open,
  onClose,
  labelledBy,
  side = 'center',
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  /** 'center' = modal dialog, 'right' = slide-over drawer. */
  side?: 'center' | 'right'
  className?: string
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Delay until the portal has painted so the first control can take focus.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const target = panel.querySelector<HTMLElement>('[data-autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      target?.focus()
    }, 30)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => element.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex" role="presentation">
      <div
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-[fade-in_.18s_ease]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={[
          'relative z-10 flex max-h-full flex-col bg-white shadow-float outline-none',
          side === 'right'
            ? 'ml-auto h-full w-full max-w-md animate-[slide-in-right_.25s_cubic-bezier(.22,1,.36,1)]'
            : `m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-card animate-[pop-in_.2s_cubic-bezier(.22,1,.36,1)] ${className ?? ''}`,
          'sm:max-h-[calc(100dvh-2rem)]',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-muted shadow-card transition hover:bg-white hover:text-ink"
          aria-label="Close"
        >
          <X size={17} aria-hidden />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
