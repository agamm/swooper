// API functions for React Query

import type { DomainStatus } from './domain-status'
import type { RankedDomain } from './rank-domains'
import type { PatternSuggestion } from './suggest-patterns'

export interface ExpandResponse {
  domains: string[]
  query: string
  options: Record<string, string[]>
}

export interface CheckResponse {
  domain: string
  status: DomainStatus
  isAvailable: boolean
}

export interface ExpandMoreResponse extends ExpandResponse {
  message?: string
}

export interface RankResponse {
  ranked: RankedDomain[]
}

export interface SuggestPatternsResponse {
  patterns: PatternSuggestion[]
  error?: string
}

// Expand domains API
export async function expandDomains(query: string): Promise<ExpandResponse> {
  const response = await fetch('/api/domains/expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error('Failed to expand domains')
  }

  return response.json()
}

// Check domain availability API
export async function checkDomainAvailability(domain: string, signal?: AbortSignal): Promise<CheckResponse> {
  const response = await fetch('/api/domains/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to check domain availability')
  }

  return response.json()
}

// Expand more domains API
export async function expandMoreDomains(params: {
  query: string
  generatedDomains: string[]
  options: Record<string, string[]>
}): Promise<ExpandMoreResponse> {
  const response = await fetch('/api/domains/expand-more', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error('Failed to generate more domain suggestions')
  }

  return response.json()
}

// Turn a plain-language brief into Swooper patterns
export async function suggestPatterns(brief: string, signal?: AbortSignal): Promise<SuggestPatternsResponse> {
  const response = await fetch('/api/domains/suggest-patterns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief }),
    signal,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to suggest patterns')
  }

  return data
}

// Rank available domains API
export async function rankDomains(
  query: string,
  domains: string[],
  signal?: AbortSignal,
): Promise<RankResponse> {
  const response = await fetch('/api/domains/rank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, domains }),
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to rank domains')
  }

  return response.json()
}
