// Client-safe domain vocabulary. `lib/whois.ts` pulls in `fs` and `dns`, so
// anything the browser needs to know about a domain lives here instead.

export type DomainStatus = 'available' | 'taken' | 'unknown'

/**
 * Rough brandability score, higher is better. Used to sort available names so
 * the short, clean, pronounceable ones surface first instead of appearing in
 * whatever order the cartesian product happened to produce.
 */
export function brandabilityScore(domain: string): number {
  const name = domain.split('.')[0] ?? domain
  let score = 100

  // Length is the dominant factor: every character past 8 costs.
  score -= Math.max(0, name.length - 8) * 6

  if (name.includes('-')) score -= 25
  if (/\d/.test(name)) score -= 20

  // Runs of 3+ consonants or vowels are the usual "hard to say out loud" tell.
  const awkwardRuns = name.match(/[bcdfghjklmnpqrstvwxz]{3,}|[aeiou]{3,}/g)?.length ?? 0
  score -= awkwardRuns * 12

  // Doubled letters at a word seam (e.g. "fireeagle") read badly.
  if (/(.)\1/.test(name)) score -= 6

  // A vowel-consonant mix roughly tracks pronounceability.
  const vowels = (name.match(/[aeiouy]/g) ?? []).length
  const vowelRatio = name.length > 0 ? vowels / name.length : 0
  if (vowelRatio < 0.2 || vowelRatio > 0.6) score -= 10

  return score
}

export function sortByBrandability(domains: string[]): string[] {
  return [...domains].sort((a, b) => {
    const diff = brandabilityScore(b) - brandabilityScore(a)
    if (diff !== 0) return diff
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b)
  })
}
