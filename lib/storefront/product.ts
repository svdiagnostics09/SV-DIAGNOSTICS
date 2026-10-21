/**
 * Storefront product type and the catalogue → storefront mapping.
 *
 * Deliberately free of 'use client': both server pages (homepage) and client
 * components (carousel, modal) import these, so they must be callable on the
 * server. Keep this module free of React state or browser APIs.
 */

/** A product as the storefront presents it — either a catalogue test or a package. */
export interface StoreProduct {
  kind: 'test' | 'package'
  id: number
  name: string
  slug: string
  /** Short description shown on the card. */
  description: string
  /** Fuller description shown in the details modal. */
  detail?: string
  categoryName: string
  /** Current selling price in paise. */
  pricePaise: number
  /** Undiscounted price in paise; equal to pricePaise when there is no discount. */
  listPricePaise: number
  /** Number of parameters / tests included, when known. */
  parameterCount?: number
  /** Report turnaround in hours. */
  turnaroundHours: number | null
  homeCollection: boolean
  /** Preparation note (fasting etc.). */
  preparation?: string
  sampleType?: string
  isPopular?: boolean
}

/** Convert a catalogue test row into the storefront product shape. */
export function fromTest(test: {
  id: number; name: string; slug: string; shortDescription: string; description: string
  categoryName: string; pricePaise: number; listPricePaise: number; turnaroundHours: number | null
  homeCollection: boolean; preparation: string; sampleType: string; isPopular: boolean; investigationCount?: number
}): StoreProduct {
  return {
    kind: 'test',
    id: test.id,
    name: test.name,
    slug: test.slug,
    description: test.shortDescription || test.description,
    detail: test.description,
    categoryName: test.categoryName || 'Diagnostic test',
    pricePaise: test.pricePaise,
    listPricePaise: test.listPricePaise,
    parameterCount: test.investigationCount,
    turnaroundHours: test.turnaroundHours,
    homeCollection: test.homeCollection,
    preparation: test.preparation,
    sampleType: test.sampleType,
    isPopular: test.isPopular,
  }
}

/** Convert a catalogue package row into the storefront product shape. */
export function fromPackage(pack: {
  id: number; name: string; slug: string; description: string; preparation: string; sampleType: string
  turnaroundHours: number | null; pricePaise: number; originalPricePaise: number | null
  homeCollection: boolean; isPopular: boolean; testCount: number
}): StoreProduct {
  return {
    kind: 'package',
    id: pack.id,
    name: pack.name,
    slug: pack.slug,
    description: pack.description,
    detail: pack.description,
    categoryName: 'Health package',
    pricePaise: pack.pricePaise,
    listPricePaise: pack.originalPricePaise && pack.originalPricePaise > pack.pricePaise ? pack.originalPricePaise : pack.pricePaise,
    parameterCount: pack.testCount,
    turnaroundHours: pack.turnaroundHours,
    homeCollection: pack.homeCollection,
    preparation: pack.preparation,
    sampleType: pack.sampleType,
    isPopular: pack.isPopular,
  }
}

/** Discount percentage (0 when there is no discount). */
export const discountPercent = (product: { pricePaise: number; listPricePaise: number }) =>
  product.listPricePaise > product.pricePaise
    ? Math.round(((product.listPricePaise - product.pricePaise) / product.listPricePaise) * 100)
    : 0
