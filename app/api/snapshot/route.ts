import { NextResponse } from 'next/server'
import { buildSnapshot } from '@/lib/snapshot'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public read model for the site and console. No demo data — all SQLite. */
export async function GET() {
  return NextResponse.json(await buildSnapshot(), { headers: { 'Cache-Control': 'no-store' } })
}
