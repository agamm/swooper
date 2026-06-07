export function extractPatterns(input: string): { pattern: string; startIndex: number; endIndex: number }[] {
  const patterns: { pattern: string; startIndex: number; endIndex: number }[] = []
  const regex = /\(([^()]*)\)/g
  let match

  while ((match = regex.exec(input)) !== null) {
    // Only add non-empty patterns
    if (match[1].trim().length > 0) {
      patterns.push({
        pattern: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  return patterns
}

export function cartesianProduct<T>(...arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => {
      const result: T[][] = []
      for (const accItem of acc) {
        for (const currItem of curr) {
          result.push([...accItem, currItem])
        }
      }
      return result
    },
    [[]],
  )
}

// Upper bound on the number of domains a single query can expand to. Guards
// against a combinatorial blow-up (e.g. 4 patterns x 50 options = 6.25M strings)
// that would otherwise be built entirely in memory.
export const MAX_PERMUTATIONS = 5000

// Trim each pattern's option list so the cartesian product stays within `limit`.
// Caps every list to floor(limit^(1/n)) elements, which leaves realistic inputs
// (a handful of patterns with ~10-20 options each) untouched.
function capOptionArrays(optionArrays: string[][], limit: number): string[][] {
  const perPatternCap = Math.max(1, Math.floor(Math.pow(limit, 1 / optionArrays.length)))
  return optionArrays.map((opts) => (opts.length > perPatternCap ? opts.slice(0, perPatternCap) : opts))
}

export function generatePermutations(
  query: string,
  options: Record<string, string[]>, // options by index: {"0": ["opt1", "opt2"], "1": ["opt3", "opt4"]}
  limit: number = MAX_PERMUTATIONS,
): string[] {
  // Extract all patterns from query in order
  const patterns = extractPatterns(query)
  
  if (patterns.length === 0) {
    return [query]
  }

  // Build arrays of options in the same order as patterns appear
  const optionArrays: string[][] = []
  for (let i = 0; i < patterns.length; i++) {
    const opts = options[i.toString()]
    if (!opts || opts.length === 0) {
      // If no options for this pattern, skip this pattern entirely
      return []
    }
    optionArrays.push(opts)
  }

  const combinations = cartesianProduct(...capOptionArrays(optionArrays, limit))

  return combinations.map((combination) => {
    let result = query
    let offset = 0

    patterns.forEach((pattern, index) => {
      const replacement = combination[index]
      const adjustedStart = pattern.startIndex + offset
      const adjustedEnd = pattern.endIndex + offset
      const originalLength = adjustedEnd - adjustedStart

      result = result.slice(0, adjustedStart) + replacement + result.slice(adjustedEnd)
      offset += replacement.length - originalLength
    })

    return result
  })
}