'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Fingerprint, LockKeyhole, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import type { AdminAuthApi } from '@/hooks/use-realtime'

export function AdminLogin({ auth, onBack }: { auth: AdminAuthApi; onBack: () => void }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const result = await auth.signIn(id, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      setPassword('')
    }
  }

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#050a16] lg:grid-cols-[1.1fr_.9fr]">
      {/* Ambient mesh background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-10%] size-[38rem] rounded-full bg-[#0f6fb5]/25 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] size-[32rem] rounded-full bg-[#22d3a6]/20 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* Brand side */}
      <div className="relative hidden flex-col justify-between p-12 lg:flex">
        <button onClick={onBack} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white">
          <ArrowLeft size={16} /> Back to website
        </button>
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-[var(--brand)] text-white shadow-lg shadow-[#0f6fb5]/25">
              <ShieldCheck />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">SV Diagnostics</span>
          </div>
          <h1 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">
            The operations console for <span className="text-[#7cc3ef]">calm, live care.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/55">
            Live collections, slot capacity, revenue and report hand-offs — one secure workspace for the whole team.
          </p>
          <dl className="mt-10 grid max-w-sm grid-cols-3 gap-4">
            {[['99.9%', 'Uptime'], ['6 hrs', 'Avg. report'], ['8', 'Areas live']].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                <dt className="text-xl font-semibold text-white">{value}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-wider text-white/45">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-xs text-white/35">Protected workspace · Sessions expire after 8 hours</p>
      </div>

      {/* Form side */}
      <div className="relative flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white lg:hidden">
            <ArrowLeft size={16} /> Back to website
          </button>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">
              <Fingerprint size={13} /> Staff access
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Sign in to your workspace</h2>
            <p className="mt-2 text-sm text-white/50">Use the staff ID and password issued by your operations lead.</p>

            <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">Staff ID</span>
                <div className="relative">
                  <UserRound size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                    autoComplete="username"
                    autoFocus
                    placeholder="admin"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#0f6fb5]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#0f6fb5]/15"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">Password</span>
                <div className="relative">
                  <LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={reveal ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#0f6fb5]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#0f6fb5]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((value) => !value)}
                    aria-label={reveal ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
                  >
                    {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {error && (
                <p role="alert" className="rounded-xl border border-[#ff6b6b]/25 bg-[#ff6b6b]/10 px-3.5 py-2.5 text-xs font-medium text-[#ffb3b3]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-3 text-sm font-semibold text-white shadow-lg shadow-[#0f6fb5]/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {busy ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : <>Sign in <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /></>}
              </button>
            </form>

            {auth.demoMode && (
              <div className="mt-6 rounded-xl border border-[#f5b544]/20 bg-[#f5b544]/[0.08] p-3.5 text-xs leading-5 text-[#f7d08a]">
                <b className="block text-[#ffd899]">Local demo credentials</b>
                ID <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">admin</code> · Password{' '}
                <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">admin@1234</code>
                <span className="mt-1 block text-[11px] text-[#f7d08a]/70">Set ADMIN_ID and ADMIN_PASSWORD to replace these.</span>
              </div>
            )}
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/35">
            <LockKeyhole size={12} /> Sessions are signed and expire automatically. Never share your credentials.
          </p>
        </div>
      </div>
    </div>
  )
}
