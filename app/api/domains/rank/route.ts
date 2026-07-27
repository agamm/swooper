import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rankDomains } from '@/lib/rank-domains'
import { LANDING_ONLY } from '@/lib/config'

// Ranking is a judgement call over a short list, so it stays cheap: a handful
// of candidates and a small model. More than this and the reasoning gets vague
// rather than better.
const MAX_CANDIDATES = 40

const requestSchema = z.object({
  query: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
})

export async function POST(request: NextRequest) {
  if (LANDING_ONLY) {
    return NextResponse.json(
      { error: 'The hosted demo is disabled. Deploy your own copy: https://github.com/agamm/swooper', ranked: [] },
      { status: 403 },
    )
  }

  try {
    const body = await request.json()
    const { query, domains } = requestSchema.parse(body)

    const ranked = await rankDomains(query, domains.slice(0, MAX_CANDIDATES))

    return NextResponse.json({ ranked })
  } catch (error) {
    console.error('Error ranking domains:', error)
    return NextResponse.json({ error: 'Failed to rank domains' }, { status: 500 })
  }
}
