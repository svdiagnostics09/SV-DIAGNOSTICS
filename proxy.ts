import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'sv_admin_session'

/**
 * Edge guard. Fast rejects only — every route and page re-verifies the
 * session against the database, so a forged cookie gets nowhere.
 *
 * 1. Admin pages without a cookie redirect to the login screen.
 * 2. Admin APIs without a cookie return 401 (login/session are exempt).
 * 3. State-changing requests must carry `x-sv-request: fetch` and, when an
 *    Origin header is present, be same-origin (CSRF defence in depth). The
 *    Razorpay webhook is exempt from the header check (it is HMAC-verified).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth/') && !request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if ((pathname.startsWith('/api/') || pathname.startsWith('/admin')) && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const isWebhook = pathname.startsWith('/api/payments/webhook')
    if (!isWebhook && request.headers.get('x-sv-request') !== 'fetch') {
      return NextResponse.json({ error: 'Missing request header.' }, { status: 403 })
    }
    const origin = request.headers.get('origin')
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 })
      } catch {
        return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/admin/:path*', '/admin/:path*'],
}
