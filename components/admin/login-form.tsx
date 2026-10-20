'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const response = await fetch('/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch' }, body: JSON.stringify({ email, password }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setBusy(false); setError(body.error ?? 'Sign in failed.'); return }
    router.replace('/admin')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mt-6 card p-6" noValidate>
      <div>
        <label htmlFor="admin-email" className="label">Administrator email or username</label>
        <input id="admin-email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="input" required autoFocus />
      </div>
      <div className="mt-4">
        <label htmlFor="admin-password" className="label">Password</label>
        <div className="relative">
          <input id="admin-password" type={show ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="input pr-10" required />
          <button type="button" onClick={() => setShow((value) => !value)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-muted hover:bg-page" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 flex items-start gap-1.5 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12.5px] text-danger"><AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden /> {error}</p>}
      <button type="submit" disabled={busy || !email || !password} className="btn btn-primary mt-5 w-full">
        {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Signing in…</> : <><LogIn size={15} aria-hidden /> Sign in</>}
      </button>
      <p className="mt-4 text-[11.5px] leading-5 text-muted">Forgot your password? The owner can reset it from the server with <code className="rounded bg-page px-1 font-mono text-[10.5px]">npm run admin:create</code>. There is no public sign-up.</p>
    </form>
  )
}
