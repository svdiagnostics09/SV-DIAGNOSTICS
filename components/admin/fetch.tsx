'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Small fetch helper for admin screens: JSON in, JSON out, errors surfaced. */
export async function adminFetch<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' } : { 'x-sv-request': 'fetch' },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    })
    if (response.status === 401) {
      window.location.assign('/admin/login')
      return { ok: false, error: 'Session expired.', status: 401 }
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, error: (data as { error?: string }).error ?? 'Request failed.', status: response.status }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.', status: 0 }
  }
}

/** Loads admin data, exposes loading / error / polling states. */
export function useAdminResource<T>(url: string, options: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    const result = await adminFetch<T>(url)
    if (!mounted.current) return
    if (result.ok) { setData(result.data); setError(null) } else setError(result.error)
    setLoading(false)
    setRefreshing(false)
  }, [url])

  useEffect(() => {
    mounted.current = true
    void load()
    let timer: ReturnType<typeof setInterval> | undefined
    if (options.pollMs) {
      const tick = () => { if (document.visibilityState === 'visible') void load(true) }
      timer = setInterval(tick, options.pollMs)
    }
    return () => { mounted.current = false; if (timer) clearInterval(timer) }
  }, [load, options.pollMs])

  return { data, loading, refreshing, error, reload: () => load(true), setData }
}

/** Toast queue for save/delete feedback. */
export function useToasts() {
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; tone: 'success' | 'error' }>>([])
  const push = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current.slice(-2), { id, text, tone }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000)
  }, [])
  return { toasts, push, dismiss: (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)) }
}

export function ToastStack({ toasts, onDismiss }: { toasts: Array<{ id: number; text: string; tone: 'success' | 'error' }>; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" onClick={() => onDismiss(toast.id)} className={`card animate-in flex items-start gap-2 px-3.5 py-2.5 text-left text-[12.5px] shadow-card ${toast.tone === 'error' ? 'border-[#fecaca] text-danger' : 'border-[#a7e8df] text-[#0f766b]'}`}>
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
          <span className="flex-1">{toast.text}</span>
        </button>
      ))}
    </div>
  )
}

export { formatDate } from '@/lib/format'
export const rupees = (paise: number) => (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
