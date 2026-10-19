import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, importPriceList, listTests } from '@/lib/store'
import { priceList } from '@/lib/price-list'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Publishes the SV price list into the bookable catalogue so every
 * investigation can be booked from the homepage. Safe to run repeatedly:
 * tests are matched by name, prices are refreshed, admin discounts are kept.
 */
export async function POST(request: Request) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const result = await importPriceList(priceList)
  await addActivity('system', `Price list synced to catalogue — ${result.inserted} added, ${result.updated} updated`)
  publish('tests')
  publish('activity')

  return NextResponse.json({ ...result, catalogueSize: (await listTests()).length })
}
