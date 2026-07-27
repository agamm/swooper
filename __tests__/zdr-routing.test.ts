import { describe, it, expect, vi, afterEach } from 'vitest'

// Every prompt carries the user's unreleased product idea, so the provider
// routing block is a privacy control, not a preference. These tests assert it
// actually reaches the wire — a typo in the settings object would otherwise be
// invisible, since OpenRouter silently ignores unknown fields.

function captureRequestBody() {
  const bodies: Record<string, unknown>[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body === 'string') bodies.push(JSON.parse(init.body))
      // Fail fast: we only care about what was sent, not the reply.
      return new Response(JSON.stringify({ error: { message: 'intercepted' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )

  return bodies
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenRouter ZDR routing', () => {
  it('sends zero-data-retention routing on option generation', async () => {
    const bodies = captureRequestBody()
    const { generateOptionsForPattern } = await import('@/lib/generate-options')

    await generateOptionsForPattern('animals')

    expect(bodies.length).toBeGreaterThan(0)
    expect(bodies[0].provider).toEqual({ zdr: true, data_collection: 'deny' })
  })

  it('sends zero-data-retention routing when ranking', async () => {
    const bodies = captureRequestBody()
    const { rankDomains } = await import('@/lib/rank-domains')

    await rankDomains('(animals).com', ['firewolf.com', 'firehawk.com'])

    expect(bodies.length).toBeGreaterThan(0)
    expect(bodies[0].provider).toEqual({ zdr: true, data_collection: 'deny' })
  })

  it('sends zero-data-retention routing when suggesting patterns', async () => {
    const bodies = captureRequestBody()
    const { suggestPatterns } = await import('@/lib/suggest-patterns')

    await suggestPatterns('a climbing weather app').catch(() => {
      // The intercepted 500 rejects; the request body is what matters.
    })

    expect(bodies.length).toBeGreaterThan(0)
    expect(bodies[0].provider).toEqual({ zdr: true, data_collection: 'deny' })
  })
})
