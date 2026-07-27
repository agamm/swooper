import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import validator from 'validator'
import { extractPatterns, generatePermutations } from '@/lib/patterns'
import { generateOptionsForPattern } from '@/lib/generate-options'
import { LANDING_ONLY } from '@/lib/config'

const requestSchema = z.object({
  query: z.string().min(1)
})

export async function POST(request: NextRequest) {
  if (LANDING_ONLY) {
    return NextResponse.json(
      { error: 'The hosted demo is disabled. Deploy your own copy: https://github.com/agamm/swooper', domains: [], query: '', options: {} },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { query } = requestSchema.parse(body)
    
    const patterns = extractPatterns(query)
    
    // Limit to maximum 4 patterns
    if (patterns.length > 4) {
      return NextResponse.json({ 
        error: 'Too many patterns. Maximum 4 patterns allowed per query.',
        domains: [], 
        query, 
        options: {} 
      }, { status: 400 })
    }
    
    // If no patterns, just validate the domain
    if (patterns.length === 0) {
      const isValid = validator.isFQDN(query, { require_tld: true })
      if (!isValid) {
        return NextResponse.json({ domains: [], query, options: {} })
      }
      return NextResponse.json({ domains: [query], query, options: {} })
    }
    
    // One LLM call per pattern, all in flight at once — they don't depend on
    // each other, and serialising them made a 4-pattern query 4x slower.
    const generated = await Promise.all(patterns.map((p) => generateOptionsForPattern(p.pattern)))

    const options: Record<string, string[]> = {}
    generated.forEach((patternOptions, i) => {
      if (patternOptions.length > 0) {
        options[i.toString()] = patternOptions
      }
    })

    if (Object.keys(options).length === 0) {
      return NextResponse.json({ domains: [], query, options: {} })
    }
    
    // Generate all permutations
    const permutations = generatePermutations(query, options)
    const validDomains = permutations
      .map((domain) => domain.toLowerCase())
      .filter((domain) => validator.isFQDN(domain, { require_tld: true }))
      .filter((domain, index, arr) => arr.indexOf(domain) === index)

    return NextResponse.json({
      domains: validDomains,
      query,
      options
    })
    
  } catch (error) {
    console.error('Error expanding domains:', error)
    return NextResponse.json(
      { error: 'Failed to expand domains' },
      { status: 500 }
    )
  }
}