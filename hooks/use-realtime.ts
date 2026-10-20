'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Snapshot } from '@/lib/snapshot'

type Status = 'connecting' | 'live' | 'reconnecting'

export interface AdminUser {
  id: string
  name: string
  role: string
}

export interface RealtimeApi {
  status: Status
  connected: boolean
  data: Snapshot | null
  toasts: { id: number; text: string }[]
  dismissToast: (id: number) => void
  book: (input: { name: string; phone: string; testId: number; type: 'Home collection' | 'Lab visit'; slot: string; pincode?: string }) => Promise<{ ok: true; orderId: string } | { ok: false; error: string }>
  refresh: () => Promise<void>
}

export interface AdminAuthApi {
  user: AdminUser | null
  checking: boolean
  demoMode: boolean
  signIn: (id: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

/** The SSE stream only signals *that* something changed; we re-read from SQLite. */
export function useRealtime(): RealtimeApi {
  const [status, setStatus] = useState<Status>('connecting')
  const [data, setData] = useState<Snapshot | null>(null)
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const retry = useRef(0)
  const toastId = useRef(0)
  const sourceRef = useRef<EventSource | null>(null)

  const pushToast = useCallback((text: string) => {
    const id = ++toastId.current
    setToasts((current) => [...current.slice(-2), { id, text }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const refresh = useCallback(async () => {
    const response = await fetch('/api/snapshot', { cache: 'no-store' })
    if (response.ok) setData((await response.json()) as Snapshot)
  }, [])

  useEffect(() => {
    let closed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let debounce: ReturnType<typeof setTimeout> | undefined

    const scheduleRefresh = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => { void refresh() }, 120)
    }

    const connect = () => {
      const source = new EventSource('/api/realtime')
      sourceRef.current = source

      source.addEventListener('open', () => { retry.current = 0; setStatus('live') })
      source.addEventListener('snapshot', (event) => {
        setData(JSON.parse((event as MessageEvent).data) as Snapshot)
        setStatus('live')
      })
      for (const event of ['orders', 'tests', 'settings', 'activity', 'messages', 'notifications']) {
        source.addEventListener(event, scheduleRefresh)
      }
      source.addEventListener('toast', (event) => {
        const { text } = JSON.parse((event as MessageEvent).data) as { text: string }
        pushToast(text)
      })
      source.addEventListener('error', () => {
        if (closed) return
        source.close()
        setStatus('reconnecting')
        retry.current = Math.min(retry.current + 1, 6)
        reconnectTimer = setTimeout(connect, 500 * 2 ** retry.current)
      })
    }

    // Read the data over HTTP straight away, then attach the push stream for
    // live updates. This way the first paint never waits on SSE.
    void refresh()
    connect()
    return () => {
      closed = true
      clearTimeout(debounce)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      sourceRef.current?.close()
    }
  }, [pushToast, refresh])

  const book = useCallback<RealtimeApi['book']>(async (input) => {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false as const, error: body.error ?? 'Could not complete the booking.' }
    return { ok: true as const, orderId: body.orderId as string }
  }, [])

  return { status, connected: status === 'live', data, toasts, dismissToast, book, refresh }
}

export function useAdminAuth(): AdminAuthApi {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' })
      // A failed request (e.g. the database is not configured yet) returns an
      // empty body, so never assume JSON — treat it as signed out.
      const data = await response.json().catch(() => ({}))
      setUser(data.authenticated ? data.user : null)
      setDemoMode(Boolean(data.demo))
    } catch {
      setUser(null)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const expire = () => setUser(null)
    window.addEventListener('sv:session-expired', expire)
    return () => window.removeEventListener('sv:session-expired', expire)
  }, [refresh])

  const signIn = useCallback<AdminAuthApi['signIn']>(async (id, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false as const, error: data.error ?? 'Sign in failed. Please try again.' }
    setUser(data.user as AdminUser)
    setDemoMode(false)
    return { ok: true as const }
  }, [])

  const signOut = useCallback(async () => {
    await fetch('/api/auth/session', { method: 'DELETE' })
    setUser(null)
  }, [])

  return { user, checking, demoMode, signIn, signOut, refresh }
}
