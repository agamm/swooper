import { z } from 'zod'
import { generateObject } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { prettifyModelName } from './model-name'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

// Model is configurable so you can bring your own OpenRouter model.
// Any model that supports structured outputs works (see https://openrouter.ai/models).
// Cheaper alternatives: google/gemini-3.5-flash, google/gemini-3.1-flash-lite
export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-sonnet-5'

export const MODEL_DISPLAY_NAME = prettifyModelName(DEFAULT_MODEL)

// Newer flash models may spend tokens on internal reasoning before emitting the
// JSON object, so give the structured-output call enough headroom to finish.
const MAX_OUTPUT_TOKENS = 2048

// A pattern is a fragment of a domain, not a whole name. The distinction that
// matters most is category vs. style: asking for a category and getting invented
// words back is the failure mode this prompt exists to prevent.
const BASE_RULES = `You fill in one slot of a domain-name template. The user writes a pattern in parentheses and you return the list of words that could go in that slot.

Decide which kind of pattern you were given:

1. CATEGORY pattern — names a set of real things (a taxonomic group, a profession, a natural phenomenon, a mythology, a colour space).
   Return actual members of that set, as ordinary words. Do NOT invent words, add prefixes/suffixes, or make them sound like startups.
   A pattern naming a category of creatures should return the plain names of creatures, not coined variations on the word "creature".

2. STYLE pattern — describes a manner of naming rather than a set ("brandable", "invented", "startup-sounding", "portmanteau", "two X terms").
   Here invention is the point. Coin new words, blend roots, and aim for something ownable.

3. LITERAL options separated by "/" — return exactly those options, unchanged.

Additional rules:
- WORD COUNTS: "N words" means N separate single words, not compounds. Only produce compounds when the pattern says "combinations", "compound", or similar.
- SPACING: single tokens only. No spaces, no multi-word phrases.
- CHARACTERS: lowercase letters only, plus digits or hyphens if the pattern explicitly asks. Nothing that is invalid in a domain label.
- TLDs: return them bare, without the leading dot.
- SIMILARITY: "similar to X" includes X itself alongside the alternatives.
- CONSTRAINTS: honour any exact count the pattern specifies.
- LENGTH: each option is only one slot of a domain, and slots get concatenated. Keep every option under 12 characters unless the pattern explicitly asks for something longer.
- QUALITY: within whatever the pattern asks for, prefer words that are short, easy to spell, and easy to say aloud.
- DEFAULT VOLUME: at least 5 options, at most 50, unless the pattern constrains the count.`

const optionsSchema = z.object({
  options: z.array(z.string()).min(1),
})

const SLASH_PATTERN = /^[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)+$/

function parseSlashOptions(pattern: string): string[] | null {
  if (!pattern.includes('/') || !SLASH_PATTERN.test(pattern.trim())) return null
  return pattern
    .split('/')
    .map((opt) => opt.trim())
    .filter((opt) => opt.length > 0)
}

// The model occasionally returns a whole domain, a dotted TLD, or stray
// punctuation. Normalise here so the permutation step only ever sees slot-sized
// tokens that are legal inside a domain label.
function sanitizeOptions(options: string[]): string[] {
  const seen = new Set<string>()

  return options
    .map((option) => option.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, ''))
    .filter((option) => option.length > 0 && !/\s/.test(option))
    .filter((option) => /^[a-z0-9-]+$/.test(option))
    .filter((option) => !option.startsWith('-') && !option.endsWith('-'))
    .filter((option) => (seen.has(option) ? false : seen.add(option)))
}

export async function generateOptionsForPattern(pattern: string): Promise<string[]> {
  // An empty slot has no options. Sending it to the model would burn a call and
  // return arbitrary words for a pattern the user never actually wrote.
  if (!pattern.trim()) return []

  const slashOptions = parseSlashOptions(pattern)
  if (slashOptions) return slashOptions

  try {
    const { object } = await generateObject({
      model: openrouter(DEFAULT_MODEL),
      system: BASE_RULES,
      prompt: `Fill this domain slot: ${pattern}

Return the words that belong in the slot. Classify the pattern first (category, style, or literal "/" options) and follow the matching rule.`,
      temperature: 0.8,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      schema: optionsSchema,
    })

    return sanitizeOptions(object.options).slice(0, 50)
  } catch (error) {
    console.error('Failed to generate options for pattern:', pattern, error)
    return []
  }
}

export async function generateOptionsForPatternWithExclusions(pattern: string, excludedOptions: string[]): Promise<string[]> {
  if (!pattern.trim()) return []

  const slashOptions = parseSlashOptions(pattern)
  if (slashOptions) {
    const lowerExcluded = new Set(excludedOptions.map((opt) => opt.toLowerCase()))
    return slashOptions.filter((opt) => !lowerExcluded.has(opt.toLowerCase()))
  }

  const budget = Math.max(10, Math.min(20, excludedOptions.length))

  try {
    const { object } = await generateObject({
      model: openrouter(DEFAULT_MODEL),
      system: `${BASE_RULES}

This is a follow-up request. The user has already seen the excluded options listed in the prompt and wants different ones.
- Never return anything from the excluded list.
- Stay within the same kind of pattern — a category pattern still needs real members of that category, just ones not yet shown.
- Reach for the less obvious end of the set rather than drifting into a different set.
- Return at most ${budget} options.`,
      prompt: `Fill this domain slot again, with options that have not been used: ${pattern}

Already used — do not repeat any of these:
${excludedOptions.join(', ')}`,
      temperature: 0.95, // Higher temperature for more variety on the second pass
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      schema: optionsSchema,
    })

    const lowerExcluded = new Set(excludedOptions.map((opt) => opt.toLowerCase()))

    return sanitizeOptions(object.options)
      .filter((option) => !lowerExcluded.has(option))
      .slice(0, 20)
  } catch (error) {
    console.error('Failed to generate options for pattern:', pattern, error)
    return []
  }
}
