// The rules that decide whether a query is something Swooper can expand.
// Shared so the input box and the pattern suggester agree on what is legal —
// a suggested pattern the input would reject is worse than no suggestion.

export interface QueryValidation {
  isValid: boolean
  error: string | null
}

export const MAX_PATTERNS_PER_QUERY = 4

export function validateDomainQuery(query: string): QueryValidation {
  if (!query.trim()) {
    return { isValid: true, error: null }
  }

  const braces = query.match(/\(|\)/g) || []

  let openCount = 0
  for (const brace of braces) {
    if (brace === '(') {
      openCount++
    } else {
      openCount--
      if (openCount < 0) {
        return { isValid: false, error: 'Found closing ) without opening ( - did you forget to add an opening parenthesis?' }
      }
    }
  }

  if (openCount !== 0) {
    return { isValid: false, error: 'Unmatched parentheses - make sure each ( has a closing )' }
  }

  if (/\(\s*\)/.test(query)) {
    return { isValid: false, error: 'Empty pattern () is not allowed - try to write something inside the parentheses. ' }
  }

  // Blank out the patterns, then check that whatever is left is domain-legal.
  const outsidePattern = query.replace(/\([^)]*\)/g, '')
  const invalidChars = outsidePattern.match(/[^a-zA-Z0-9.-]/g)

  if (invalidChars) {
    const firstInvalidChar = invalidChars[0]
    return {
      isValid: false,
      error: `Invalid character '${firstInvalidChar}' outside parentheses. ${
        firstInvalidChar === '/'
          ? 'Did you mean to put it inside parentheses like (option1/option2)?'
          : 'Only letters, numbers, dots, and dashes allowed outside ( ).'
      }`,
    }
  }

  const patternMatches = query.match(/\([^)]*\)/g) || []
  if (patternMatches.length > MAX_PATTERNS_PER_QUERY) {
    return {
      isValid: false,
      error: `Too many patterns. Maximum ${MAX_PATTERNS_PER_QUERY} patterns allowed per query.`,
    }
  }

  return { isValid: true, error: null }
}

/**
 * Stricter than `validateDomainQuery`: a suggestion is only useful if it also
 * has something for the AI to fill in and ends in a TLD. The input box stays
 * permissive so a half-typed query isn't flagged as an error mid-keystroke.
 */
export function isUsableSuggestion(query: string): boolean {
  const trimmed = query.trim()
  if (!validateDomainQuery(trimmed).isValid) return false

  // At least one slot to expand, otherwise it is just a single domain.
  if (!/\([^)]+\)/.test(trimmed)) return false

  // Must have a TLD section after a dot: either literal (.com) or a pattern.
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot === -1 || lastDot === trimmed.length - 1) return false

  const tldPart = trimmed.slice(lastDot + 1)
  return /^[a-z0-9-]+$/i.test(tldPart) || /^\([^)]+\)$/.test(tldPart)
}

// A trailing slot that lists short alphanumeric options, e.g. "(com/io/ai)".
// Deliberately narrow: it is the one shape we can safely assume is a TLD.
const TRAILING_TLD_SLOT = /\(([a-z0-9]+(?:\/[a-z0-9]+)+)\)$/i

/**
 * Fix the small mechanical mistakes a model makes when writing a pattern, then
 * re-validate. Returns null when the pattern is still unusable — a suggestion
 * the search box would reject is worse than one fewer suggestion.
 */
export function repairSuggestion(raw: string): string | null {
  let candidate = raw.trim().replace(/^["'`]+|["'`]+$/g, '')
  if (!candidate) return null

  // Spaces are meaningful inside a slot but never outside one.
  candidate = candidate.replace(/\)\s+/g, ')').replace(/\s+\(/g, '(')
  candidate = candidate.replace(/\s*\.\s*/g, '.')
  candidate = candidate.replace(/\.+$/, '')

  // "(word)(com/io)" is missing the dot before its TLD slot. Only repair when
  // that trailing slot is unambiguously a TLD list, so "(adj)(noun)" — which
  // would become a nonsense ".(noun)" TLD — stays rejected instead.
  if (TRAILING_TLD_SLOT.test(candidate)) {
    candidate = candidate.replace(TRAILING_TLD_SLOT, (match, options, offset: number) =>
      offset > 0 && candidate[offset - 1] !== '.' ? `.(${options})` : match,
    )
  }

  return isUsableSuggestion(candidate) ? candidate : null
}
