import { z } from 'zod'
import { generateObject } from 'ai'
import { zdrModel } from './openrouter'
import { DEFAULT_MODEL } from './generate-options'
import { repairSuggestion } from './validate-query'

export const MAX_SUGGESTIONS = 5

export interface PatternSuggestion {
  /** A Swooper query, e.g. "fire(animals).com" */
  pattern: string
  /** One line on the naming strategy this pattern takes. */
  angle: string
  /** Illustrative domains this pattern would produce. Not availability-checked. */
  examples: string[]
}

const suggestionSchema = z.object({
  patterns: z
    .array(
      z.object({
        pattern: z.string(),
        angle: z.string(),
        examples: z.array(z.string()),
      }),
    )
    .min(1),
})

// Five patterns that are variations of one idea are worth about as much as one
// pattern. Naming the strategies explicitly is what makes the set a spread
// rather than a list.
const SYSTEM_PROMPT = `You translate a description of a project into search patterns for Swooper, a domain finder.

A Swooper pattern is a domain with parenthesised slots that get filled in:
- "(...)" is a slot. A slot naming a real-world category yields real members of it; a slot describing a style yields coined words.
- "(a/b/c)" is a literal choice between exactly those options — useful for TLDs, e.g. "(com/io/ai)".
- Everything outside the parentheses is literal text and must be valid in a domain: letters, digits, dots, hyphens. No spaces, no slashes outside parentheses.
- At most 4 slots per pattern. Every pattern must end in a TLD, either literal (".com") or a slot ("(com/io)").
- The TLD is always preceded by a dot. Write "name.(com/io)", never "name(com/io)".

Return exactly ${MAX_SUGGESTIONS} patterns, and make each one take a DIFFERENT naming strategy. Draw from approaches such as:
- A concrete category crossed with a literal word from the description
- A coined or blended word, invented rather than assembled
- A metaphor or image drawn from the domain of the problem, not its jargon
- A short, abstract, brandable name with no literal meaning
- A real dictionary word paired with a TLD that completes or puns on it

Pick the strategies that actually suit the description; do not force one that does not fit.

For each pattern give:
- "pattern": the query itself, nothing else. No explanation, no quotes, no trailing punctuation.
- "angle": one short sentence (under 12 words) on what this approach is going for.
- "examples": 2 or 3 plausible domains this pattern would produce, written out in full. These illustrate the shape — they need not be available.

Every slot must be able to yield at least 10 different fills, because a pattern that expands to one or two names is not worth searching. Write the slot as the SET you want, not as a single member of it: a slot naming a category in the plural, or describing a kind of word, expands; a slot containing one bare noun does not.

Prefer TLDs that fit the described use case. Keep the resulting names short.`

export async function suggestPatterns(brief: string): Promise<PatternSuggestion[]> {
  if (!brief.trim()) return []

  const { object } = await generateObject({
    model: zdrModel(DEFAULT_MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Here is what I am building and the kind of name I want:

${brief}

Give me ${MAX_SUGGESTIONS} different patterns to search.`,
    temperature: 0.9,
    // Five patterns each carrying an angle and three examples, plus whatever
    // the model spends on internal reasoning. Too low and the JSON is returned
    // truncated, which surfaces as a parse error rather than a short list.
    maxOutputTokens: 6000,
    schema: suggestionSchema,
  })

  const seen = new Set<string>()
  const discarded: string[] = []

  const suggestions = object.patterns.flatMap((item) => {
    const pattern = repairSuggestion(item.pattern)
    if (!pattern) {
      discarded.push(item.pattern)
      return []
    }

    const key = pattern.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)

    return [
      {
        pattern,
        angle: item.angle.trim(),
        examples: item.examples.map((example) => example.trim().toLowerCase()).filter(Boolean).slice(0, 3),
      },
    ]
  })

  if (discarded.length > 0) {
    console.warn('Discarded unusable suggested patterns:', discarded)
  }

  return suggestions.slice(0, MAX_SUGGESTIONS)
}
