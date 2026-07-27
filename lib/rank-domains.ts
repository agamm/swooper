import { z } from 'zod'
import { generateObject } from 'ai'
import { zdrModel } from './openrouter'
import { sortByBrandability } from './domain-status'

// Ranking is a much easier job than inventing names, so it runs on a cheaper
// model than generation by default. Override independently of OPENROUTER_MODEL.
export const RANKER_MODEL = process.env.OPENROUTER_RANKER_MODEL?.trim() || 'google/gemini-3.1-flash-lite'

const TOP_N = 5

const rankedSchema = z.object({
  ranked: z
    .array(
      z.object({
        domain: z.string(),
        reason: z.string(),
      }),
    )
    .min(1),
})

export interface RankedDomain {
  domain: string
  reason: string
}

export async function rankDomains(query: string, domains: string[]): Promise<RankedDomain[]> {
  if (domains.length === 0) return []

  try {
    const { object } = await generateObject({
      model: zdrModel(RANKER_MODEL),
      system: `You rank available domain names and explain your picks to a founder choosing one.

Judge each candidate on:
- Length and memorability — shorter and easier to say out loud wins
- Spelling — a name someone can type correctly after hearing it once
- Brandability — does it sound like a real company, not a keyword string
- Fit with what the user was searching for
- TLD suitability for the apparent use case

Return the ${TOP_N} best candidates, strongest first. Every domain you return MUST come from the candidate list exactly as written — never invent or alter one.
Each reason is one short sentence (under 15 words), concrete and specific to that name. Say what makes it work, not generic praise.`,
      prompt: `The user searched for the pattern: ${query}

These domains are confirmed available:
${domains.join('\n')}

Pick the ${TOP_N} best and explain each briefly.`,
      temperature: 0.3,
      maxOutputTokens: 1024,
      schema: rankedSchema,
    })

    // The model can still hallucinate a name that was never offered, so only
    // keep candidates that were actually in the list and are actually free.
    const allowed = new Map(domains.map((d) => [d.toLowerCase(), d]))
    const seen = new Set<string>()

    return object.ranked
      .map((item) => ({ match: allowed.get(item.domain.trim().toLowerCase()), reason: item.reason }))
      .filter((item): item is { match: string; reason: string } => Boolean(item.match))
      .filter((item) => !seen.has(item.match) && seen.add(item.match))
      .slice(0, TOP_N)
      .map((item) => ({ domain: item.match, reason: item.reason.trim() }))
  } catch (error) {
    console.error('Failed to rank domains:', error)
    // Fall back to the local heuristic so the panel still says something useful.
    return sortByBrandability(domains)
      .slice(0, TOP_N)
      .map((domain) => ({ domain, reason: 'Short and clean (ranked without AI — the model call failed).' }))
  }
}
