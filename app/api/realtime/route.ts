import { subscribe } from '@/lib/realtime'
import { buildSnapshot } from '@/lib/snapshot'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Server-Sent Events stream.
 *
 * The first frame is a full snapshot read from SQLite. Subsequent frames are
 * change notifications only (`{"type": "orders" | "tests" | ...}`) — the
 * client re-fetches so there is one source of truth.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder()
  const snapshot = await buildSnapshot()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      send('snapshot', snapshot)

      const unsubscribe = subscribe(({ type, payload }) => send(type, payload))
      const heartbeat = setInterval(() => send('heartbeat', Date.now()), 20_000)

      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed by the client
        }
      }

      request.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
