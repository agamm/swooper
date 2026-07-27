import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { suggestPatterns } from '@/lib/suggest-patterns'
import { LANDING_ONLY } from '@/lib/config'

// Long enough for a real paragraph, short enough that nobody pastes a novel
// into the prompt.
const MAX_BRIEF_LENGTH = 2000

const requestSchema = z.object({
  brief: z.string().min(1).max(MAX_BRIEF_LENGTH),
})

export async function POST(request: NextRequest) {
  if (LANDING_ONLY) {
    return NextResponse.json(
      { error: 'The hosted demo is disabled. Deploy your own copy: https://github.com/agamm/swooper', patterns: [] },
      { status: 403 },
    )
  }

  try {
    const body = await request.json()
    const { brief } = requestSchema.parse(body)

    const patterns = await suggestPatterns(brief)

    return NextResponse.json({ patterns })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Describe what you are building in up to ${MAX_BRIEF_LENGTH} characters.`, patterns: [] },
        { status: 400 },
      )
    }

    console.error('Error suggesting patterns:', error)
    return NextResponse.json({ error: 'Failed to suggest patterns', patterns: [] }, { status: 500 })
  }
}
