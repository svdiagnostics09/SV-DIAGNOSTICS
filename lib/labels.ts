/** Shared display helpers for test metadata (safe on server and client). */

export const turnaroundLabel = (hours: number | null) => {
  if (!hours) return 'Confirmed at booking'
  if (hours % 24 === 0) return `${hours / 24} day${hours === 24 ? '' : 's'}`
  if (hours > 24) return `${(hours / 24).toFixed(1).replace(/\.0$/, '')} days`
  return `${hours} hr${hours === 1 ? '' : 's'}`
}

/** Sample type shown to patients ("NA" in legacy lab sheets means none required). */
export const sampleLabel = (sample: string) => (!sample || /^na$/i.test(sample) ? 'No sample required' : sample)
