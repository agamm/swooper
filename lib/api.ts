// API functions for React Query

import type { DomainStatus } from './domain-status'
import type { RankedDomain } from './rank-domains'

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
