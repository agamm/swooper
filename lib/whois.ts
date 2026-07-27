import { readFileSync } from 'fs'
import { join } from 'path'
import axios from 'axios'
import { lookup as whoisLookup } from 'whois'
import { Semaphore } from './semaphore'
import { checkDns } from './dns-check'
import type { DomainStatus } from './domain-status'

// A domain check has three honest outcomes. Collapsing `unknown` into `taken`
// is what made the app hide genuinely free names: registry WHOIS servers reset
// the connection under load, and every reset used to render as "Taken".
export type { DomainStatus }

const TLDS_PATH = join(process.cwd(), 'lib', 'tlds.json')

// TLDs that IANA's RDAP bootstrap omits but that do run a public RDAP service.
// Verified to answer 200 for registered names and 404 for free ones, which is
// what checkRdap relies on. Without these, .io/.sh/.ac fall through to WHOIS.
const EXTRA_RDAP_SERVERS: Record<string, string> = {
  io: 'https://rdap.identitydigital.services/rdap',
  sh: 'https://rdap.identitydigital.services/rdap',
  ac: 'https://rdap.identitydigital.services/rdap',
}

// Registry WHOIS servers are the bottleneck: whois.nic.io resets ~90% of
// connections at 20-way concurrency. Two at a time, spaced out, keeps the
// answers trustworthy. Limits are per host, so .com and .io don't share a queue.
const WHOIS_MAX_CONCURRENT = 2
const WHOIS_MIN_INTERVAL_MS = 250
const WHOIS_MAX_ATTEMPTS = 3

// RDAP is HTTP and far more tolerant, but unbounded fan-out still earns 429s.
const RDAP_MAX_CONCURRENT = 10

const RESULT_CACHE_TTL_MS = 10 * 60 * 1000

const whoisSemaphores = new Map<string, Semaphore>()
const rdapSemaphores = new Map<string, Semaphore>()
const resultCache = new Map<string, { status: DomainStatus; expiresAt: number }>()

function semaphoreFor(
  pool: Map<string, Semaphore>,
  key: string,
  maxConcurrent: number,
  minInterval?: number,
): Semaphore {
  let semaphore = pool.get(key)
  if (!semaphore) {
    semaphore = new Semaphore(maxConcurrent, minInterval)
    pool.set(key, semaphore)
  }
  return semaphore
}

// Rate limiter for Domainr API
const domainrSemaphore = new Semaphore(1, 200) // 1 request per 200ms

// Cache for RDAP servers
let rdapServers: Array<[string[], string[]]> | null = null

// Helper functions
function cleanDomain(domain: string): string {
  return domain
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .replace(/\/$/, '')
    .trim()
    .toLowerCase()
}

function extractTld(domain: string): string {
  const parts = domain.split('.')
  return parts[parts.length - 1]
}

function getRdapUrl(tld: string): string | null {
  // Load RDAP servers on first use
  if (!rdapServers) {
    rdapServers = JSON.parse(readFileSync(TLDS_PATH, 'utf-8'))
  }

  const entry = rdapServers?.find(([tlds]) => tlds.includes(tld))
  if (entry) return entry[1][0].replace(/\/$/, '')

  return EXTRA_RDAP_SERVERS[tld] ?? null
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function isRetryableNetworkError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'EPIPE' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND'
  )
}

// Registries answer a throttled query with a body rather than an error, so a
// "taken"-looking response can really mean "come back later".
function isWhoisRateLimited(response: string): boolean {
  const lower = response.toLowerCase()
  return (
    lower.includes('rate limit') ||
    lower.includes('rate-limit') ||
    lower.includes('too many requests') ||
    lower.includes('exceeded the maximum allowable number') ||
    lower.includes('query rate') ||
    lower.includes('please try again later') ||
    lower.includes('quota exceeded') ||
    lower.includes('access denied')
  )
}

export function classifyWhoisResponse(response: string): DomainStatus {
  const lowerResponse = response.toLowerCase().trim()

  if (!lowerResponse) return 'unknown'
  if (isWhoisRateLimited(lowerResponse)) return 'unknown'

  // Explicit "no such domain" phrasing takes precedence over any incidental
  // mention of registration terms in the legal boilerplate that follows.
  const availablePatterns = [
    'domain not found',
    'no match for',
    'not found',
    'no entries found',
    'status: available',
    'no data found',
    'domain status: no object found',
    'no object found',
    'nothing found for this query',
    'the queried object does not exist',
    'object does not exist',
    'domain is available for registration',
  ]

  if (availablePatterns.some((pattern) => lowerResponse.includes(pattern))) {
    return 'available'
  }

  // Only then look for registration evidence. These are deliberately specific
  // ("registrant name:" not "registrant") so legal disclaimers don't trip them.
  const registrationIndicators = [
    'domain name:',
    'registrar:',
    'creation date:',
    'created:',
    'registry domain id:',
    'registrant name:',
    'registrant organization:',
    'name server:',
    'name servers:',
    'expiry date:',
    'expires:',
  ]

  if (registrationIndicators.some((indicator) => lowerResponse.includes(indicator))) {
    return 'taken'
  }

  // No usable signal either way. Say so instead of guessing "taken".
  return 'unknown'
}

// Check domain availability using Domainr API
async function checkDomainrStatus(domain: string): Promise<DomainStatus> {
  const apiKey = process.env.DOMAINR_RAPIDAPI_KEY

  if (!apiKey) {
    throw new Error('Domainr API key missing')
  }

  const { data } = await axios.get('https://domainr.p.rapidapi.com/v2/status', {
    params: { domain },
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'domainr.p.rapidapi.com',
    },
    timeout: 10000,
  })

  if (data.status && Array.isArray(data.status)) {
    const domainStatus = data.status.find((s: { domain: string; status: string }) => s.domain === domain)
    if (domainStatus) {
      // Domainr space-separated status flags: "undelegated" means nobody has
      // it; "active"/"inactive" mean registered; "unknown" means Domainr
      // couldn't reach the registry either.
      const flags: string[] = domainStatus.status.split(/\s+/)
      if (flags.includes('undelegated') && !flags.includes('active')) return 'available'
      if (flags.includes('unknown')) return 'unknown'
      return 'taken'
    }
  }

  return 'unknown'
}

async function checkRdap(domain: string, rdapUrl: string): Promise<DomainStatus> {
  const semaphore = semaphoreFor(rdapSemaphores, hostOf(rdapUrl), RDAP_MAX_CONCURRENT)

  return semaphore.run(async () => {
    try {
      await axios.get(`${rdapUrl}/domain/${domain}`, {
        timeout: 10000,
        headers: { Accept: 'application/rdap+json' },
      })
      return 'taken'
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return 'available'
      }
      // 429/5xx/network trouble tells us nothing about the domain.
      return 'unknown'
    }
  })
}

function whoisOnce(domain: string): Promise<string> {
  return new Promise((resolve, reject) => {
    whoisLookup(domain, (error: Error | null, data?: string) => {
      if (error) reject(error)
      else resolve(data ?? '')
    })
  })
}

async function checkWhois(domain: string): Promise<DomainStatus> {
  const tld = extractTld(domain)
  const semaphore = semaphoreFor(whoisSemaphores, tld, WHOIS_MAX_CONCURRENT, WHOIS_MIN_INTERVAL_MS)

  return semaphore.run(async () => {
    for (let attempt = 1; attempt <= WHOIS_MAX_ATTEMPTS; attempt++) {
      try {
        const status = classifyWhoisResponse(await whoisOnce(domain))
        if (status !== 'unknown' || attempt === WHOIS_MAX_ATTEMPTS) return status
      } catch (error) {
        if (!isRetryableNetworkError(error) || attempt === WHOIS_MAX_ATTEMPTS) return 'unknown'
      }
      // Exponential backoff: the registry is throttling us, so give it room.
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)))
    }
    return 'unknown'
  })
}

export async function checkDomainStatus(domain: string): Promise<DomainStatus> {
  const cleanedDomain = cleanDomain(domain)

  const cached = resultCache.get(cleanedDomain)
  if (cached && cached.expiresAt > Date.now()) return cached.status

  const status = await resolveDomainStatus(cleanedDomain)

  // Only cache conclusive answers; an `unknown` should be retried later.
  if (status !== 'unknown') {
    resultCache.set(cleanedDomain, { status, expiresAt: Date.now() + RESULT_CACHE_TTL_MS })
  }

  return status
}

async function resolveDomainStatus(cleanedDomain: string): Promise<DomainStatus> {
  const tld = extractTld(cleanedDomain)

  // RDAP is the authoritative source when the registry runs one.
  const rdapUrl = getRdapUrl(tld)
  if (rdapUrl) {
    const rdapStatus = await checkRdap(cleanedDomain, rdapUrl)
    if (rdapStatus !== 'unknown') return rdapStatus
  }

  // DNS can only prove the negative: resolving means somebody owns it.
  try {
    if ((await checkDns(cleanedDomain)) === false) return 'taken'
  } catch {
    // Inconclusive; keep going.
  }

  const whoisStatus = await checkWhois(cleanedDomain)
  if (whoisStatus !== 'unknown') return whoisStatus

  // Domainr is the last resort and only exists when a key is configured.
  if (process.env.DOMAINR_RAPIDAPI_KEY) {
    try {
      return await domainrSemaphore.run(() => checkDomainrStatus(cleanedDomain))
    } catch (error) {
      console.error(`Domainr check failed for ${cleanedDomain}:`, error)
    }
  }

  return 'unknown'
}

/**
 * Strict availability: `true` only when a registry actually confirmed the name
 * is free. Use `checkDomainStatus` when you need to tell "taken" from "we
 * couldn't find out".
 */
export async function isDomainAvailable(domain: string): Promise<boolean> {
  return (await checkDomainStatus(domain)) === 'available'
}
