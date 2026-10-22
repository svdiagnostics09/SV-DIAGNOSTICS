import { clientKey, isRateLimited, recordAttempt } from '@/lib/auth'
import { jsonError } from '@/lib/auth'
import { downloadByToken, pdfHeaders } from '@/lib/reports'

export const dynamic = 'force-dynamic'

/**
 * Patient report download.
 *
 * The link is `?token=<32 random bytes>` — no session and no phone number, so it
 * works from a WhatsApp chat on any device. Tokens are unguessable, revoked when
 * a newer report replaces the file, and the endpoint is rate-limited per client.
 * Responses are no-store so the PDF never sits in a shared cache.
 */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? ''
    if (token.length < 20 || token.length > 120) {
      return new Response('This report link is not valid.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    const key = clientKey(request, 'report')
    if (await isRateLimited(key, 60, 10)) {
      return new Response('Too many downloads. Please wait a few minutes and try again.', { status: 429, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    const file = await downloadByToken(token)
    if (!file) {
      return new Response('This report link has expired or was replaced. Ask the laboratory to send a fresh link.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    void recordAttempt(key).catch(() => undefined)
    return new Response(new Uint8Array(file.content), { headers: pdfHeaders(file.fileName, file.mimeType) })
  } catch (error) {
    return jsonError(error)
  }
}
