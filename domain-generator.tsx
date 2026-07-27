"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import { extractPatterns } from "@/lib/patterns"
import { brandabilityScore, type DomainStatus } from "@/lib/domain-status"
import { HighlightedInput } from "@/components/highlighted-input"
import { ExamplePatterns } from "@/components/example-patterns"
import { DomainResult } from "@/components/domain-result"
import { AiPickPanel } from "@/components/ai-pick-panel"
import { ResultControls, type ResultFilter, type ResultSort } from "@/components/result-controls"
import { useRateLimit } from "@/hooks/use-rate-limit"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { useExpandDomains } from "@/hooks/use-expand-domains"
import { useExpandMoreDomains } from "@/hooks/use-expand-more-domains"
import { useDomainCheckQueue } from "@/hooks/use-domain-check-queue"
import { useRankDomains } from "@/hooks/use-rank-domains"
import { useDebounce } from "@/hooks/use-debounce"
import { useQueryState } from "nuqs"
import { HowToSection } from "@/components/how-to-section"

interface DomainEntry {
  domain: string
  isNewBatch?: boolean
  batchId?: string
}

const AI_PICK_STORAGE_KEY = "swooper-ai-pick-enabled"

function validateDomainQuery(query: string): { isValid: boolean; error: string | null } {
  if (!query.trim()) {
    return { isValid: true, error: null }
  }

  const bracePattern = /\(|\)/g
  const matches = query.match(bracePattern) || []

  let openCount = 0
  for (const match of matches) {
    if (match === "(") {
      openCount++
    } else if (match === ")") {
      openCount--
      if (openCount < 0) {
        return { isValid: false, error: "Found closing ) without opening ( - did you forget to add an opening parenthesis?" }
      }
    }
  }

  if (openCount !== 0) {
    return { isValid: false, error: "Unmatched parentheses - make sure each ( has a closing )" }
  }

  const emptyPatternMatch = query.match(/\(\s*\)/)
  if (emptyPatternMatch) {
    return { isValid: false, error: "Empty pattern () is not allowed - try to write something inside the parentheses. " }
  }

  const outsidePattern = query.replace(/\([^)]*\)/g, "PLACEHOLDER")
  const invalidChars = outsidePattern.match(/[^a-zA-Z0-9.\-PLACEHOLDER]/g)

  if (invalidChars) {
    const firstInvalidChar = invalidChars[0]
    return {
      isValid: false,
      error: `Invalid character '${firstInvalidChar}' outside parentheses. ${firstInvalidChar === '/' ? 'Did you mean to put it inside parentheses like (option1/option2)?' : 'Only letters, numbers, dots, and dashes allowed outside ( ).'}`,
    }
  }

  // Check pattern count limit
  const patternMatches = query.match(/\([^)]*\)/g) || []
  if (patternMatches.length > 4) {
    return {
      isValid: false,
      error: "Too many patterns. Maximum 4 patterns allowed per query.",
    }
  }

  return { isValid: true, error: null }
}

// "Best first" means the names worth reading first: confirmed-free ones, then
// the ones we couldn't resolve, then the taken ones — each group by how well
// the name reads.
const STATUS_RANK: Record<DomainStatus | "pending", number> = {
  available: 0,
  pending: 1,
  unknown: 2,
  taken: 3,
}

function sortEntries(entries: DomainEntry[], statuses: Record<string, DomainStatus>): DomainEntry[] {
  return [...entries].sort((a, b) => {
    const rankDiff = STATUS_RANK[statuses[a.domain] ?? "pending"] - STATUS_RANK[statuses[b.domain] ?? "pending"]
    if (rankDiff !== 0) return rankDiff

    const scoreDiff = brandabilityScore(b.domain) - brandabilityScore(a.domain)
    if (scoreDiff !== 0) return scoreDiff

    return a.domain.localeCompare(b.domain)
  })
}

function DomainList({
  searchTerm,
  isValid,
  onSearch,
  rankerModelName,
}: {
  searchTerm: string
  isValid: boolean
  onSearch: (query: string) => void
  rankerModelName: string
}) {
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [domains, setDomains] = useState<DomainEntry[]>([])
  const [visibleCount, setVisibleCount] = useState(100)
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null)
  const [tryMoreLimitReached, setTryMoreLimitReached] = useState(false)
  const [tryMoreRemaining, setTryMoreRemaining] = useState<number | null>(null)
  const [seenAvailableDomains, setSeenAvailableDomains] = useState<Set<string>>(new Set())
  const [fadingDomains, setFadingDomains] = useState<Set<string>>(new Set())
  const [allGeneratedDomains, setAllGeneratedDomains] = useState<Set<string>>(new Set())
  const [currentOptions, setCurrentOptions] = useState<Record<string, string[]>>({})
  const [hasSearched, setHasSearched] = useState(false)
  const [filter, setFilter] = useState<ResultFilter>("all")
  const [sort, setSort] = useState<ResultSort>("original")
  const [aiPickEnabled, setAiPickEnabled] = useState(false)
  const domainRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const processingDomainsRef = useRef<Set<string>>(new Set())
  const { entries, observe, unobserve } = useIntersectionObserver({ threshold: 0.5 })

  const {
    checkDailySearchLimit,
    incrementDailySearches,
    checkTryMoreLimit,
    incrementTryMore
  } = useRateLimit()

  // Use domain expansion hooks with debounced search term
  const {
    domains: expandedDomains,
    options: expandedOptions,
    isLoading: isExpanding,
    error: expandError
  } = useExpandDomains(debouncedSearchTerm, isValid)

  const {
    expandMore,
    isLoading: isExpandingMore
  } = useExpandMoreDomains()

  const { statuses, remaining: checksRemaining, enqueue, reset: resetChecks } = useDomainCheckQueue()

  // Remember the toggle so it survives a reload.
  useEffect(() => {
    setAiPickEnabled(window.localStorage.getItem(AI_PICK_STORAGE_KEY) === "true")
  }, [])

  const handleAiPickToggle = useCallback((enabled: boolean) => {
    setAiPickEnabled(enabled)
    window.localStorage.setItem(AI_PICK_STORAGE_KEY, String(enabled))
  }, [])

  const isChecking = checksRemaining > 0

  const availableDomains = useMemo(
    () => domains.filter((entry) => statuses[entry.domain] === "available").map((entry) => entry.domain),
    [domains, statuses],
  )

  const { ranked, isLoading: isRanking, error: rankError } = useRankDomains(
    debouncedSearchTerm,
    availableDomains,
    aiPickEnabled && !isChecking,
  )

  // Track when available domains are viewed
  useEffect(() => {
    const toFade: string[] = []

    entries.forEach((entry, element) => {
      if (entry.isIntersecting) {
        const domain = element.getAttribute('data-domain')
        const isAvailable = element.getAttribute('data-status') === 'available'

        if (domain && isAvailable && !seenAvailableDomains.has(domain) && !processingDomainsRef.current.has(domain)) {
          processingDomainsRef.current.add(domain)
          toFade.push(domain)

          setTimeout(() => {
            setSeenAvailableDomains(prev => {
              const newSet = new Set(prev)
              newSet.add(domain)
              return newSet
            })
            setFadingDomains(prev => {
              const newSet = new Set(prev)
              newSet.delete(domain)
              return newSet
            })
            processingDomainsRef.current.delete(domain)
          }, 3000)
        }
      }
    })

    if (toFade.length > 0) {
      setFadingDomains(prev => {
        const newSet = new Set(prev)
        toFade.forEach(d => newSet.add(d))
        return newSet
      })
    }
  }, [entries, seenAvailableDomains])

  // Set domain ref for intersection observer
  const setDomainRef = useCallback((domain: string, element: HTMLDivElement | null) => {
    if (element) {
      domainRefs.current.set(domain, element)
      observe(element)
    } else {
      const existingElement = domainRefs.current.get(domain)
      if (existingElement) {
        unobserve(existingElement)
        domainRefs.current.delete(domain)
      }
    }
  }, [observe, unobserve])

  // Clean up observers
  useEffect(() => {
    const refs = domainRefs.current
    const processing = processingDomainsRef.current
    return () => {
      refs.forEach(el => unobserve(el))
      refs.clear()
      processing.clear()
    }
  }, [unobserve])

  // Handle expanded domains from hook
  useEffect(() => {
    if (expandedDomains.length > 0) {
      const newDomains: DomainEntry[] = expandedDomains.map((domain: string) => ({ domain }))

      resetChecks()
      setDomains(newDomains)
      setAllGeneratedDomains(new Set(expandedDomains.map((d: string) => d.toLowerCase())))
      setCurrentOptions(expandedOptions)
      setFadingDomains(new Set())
      setSeenAvailableDomains(new Set())
      setTryMoreLimitReached(false)
      setVisibleCount(100)
      setHasSearched(true)
      setFilter("all")

      // Generate a new search ID
      const searchId = `search-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      setCurrentSearchId(searchId)

      // Check daily search limit after setting domains
      const { allowed } = checkDailySearchLimit()
      if (allowed) {
        incrementDailySearches()
      }

      enqueue(newDomains.slice(0, 100).map(d => d.domain))
    }
  }, [expandedDomains, expandedOptions, checkDailySearchLimit, incrementDailySearches, enqueue, resetChecks])

  // Track when expansion completes with 0 results
  useEffect(() => {
    if (!isExpanding && !expandError && debouncedSearchTerm.trim() && extractPatterns(debouncedSearchTerm).length > 0 && isValid && expandedDomains.length === 0) {
      setHasSearched(true)
    }
  }, [isExpanding, expandError, debouncedSearchTerm, expandedDomains.length, isValid])

  // Clear state when search term changes
  useEffect(() => {
    if (!searchTerm.trim() || extractPatterns(searchTerm).length === 0) {
      resetChecks()
      setDomains([])
      setAllGeneratedDomains(new Set())
      setFadingDomains(new Set())
      setSeenAvailableDomains(new Set())
      setTryMoreLimitReached(false)
      setCurrentOptions({})
      setVisibleCount(100)
      setHasSearched(false)
      setFilter("all")
    }
  }, [searchTerm, resetChecks])

  // Monitor try more limit
  useEffect(() => {
    if (currentSearchId) {
      const { allowed, remaining } = checkTryMoreLimit(currentSearchId)
      setTryMoreRemaining(remaining)
      if (!allowed) {
        setTryMoreLimitReached(true)
      }
    }
  }, [currentSearchId, domains.length, checkTryMoreLimit])

  const orderedDomains = useMemo(
    () => (sort === "best" ? sortEntries(domains, statuses) : domains),
    [domains, statuses, sort],
  )

  const filteredDomains = useMemo(
    () => (filter === "available" ? orderedDomains.filter((entry) => statuses[entry.domain] === "available") : orderedDomains),
    [orderedDomains, filter, statuses],
  )

  const visibleDomains = filteredDomains.slice(0, visibleCount)

  // Availability is only checked for rows the user can actually reach.
  useEffect(() => {
    const pending = visibleDomains.filter((entry) => statuses[entry.domain] === undefined).map((entry) => entry.domain)
    if (pending.length > 0) enqueue(pending)
  }, [visibleDomains, statuses, enqueue])

  // Load more domains handler
  const loadMoreDomains = async () => {
    if (!currentSearchId) return

    const { allowed, remaining } = checkTryMoreLimit(currentSearchId)
    if (!allowed) {
      setTryMoreLimitReached(true)
      return
    }

    setTryMoreRemaining(remaining - 1)
    incrementTryMore(currentSearchId)

    const data = await expandMore(searchTerm, Array.from(allGeneratedDomains), currentOptions)

    if (!data || data.message || data.domains.length === 0) {
      setTryMoreLimitReached(true)
      return
    }

    // Merge the new options with current options
    const mergedOptions = { ...currentOptions }
    Object.entries(data.options).forEach(([index, newOpts]) => {
      if (newOpts.length > 0) {
        mergedOptions[index] = [...(mergedOptions[index] || []), ...newOpts]
      }
    })
    setCurrentOptions(mergedOptions)

    const batchId = `batch-${Date.now()}`
    const newDomainResults: DomainEntry[] = data.domains.map((domain: string) => ({
      domain,
      isNewBatch: true,
      batchId
    }))

    const newDomainsSet = new Set(allGeneratedDomains)
    data.domains.forEach((domain: string) => newDomainsSet.add(domain.toLowerCase()))
    setAllGeneratedDomains(newDomainsSet)

    setDomains(prev => [...prev, ...newDomainResults])
    setVisibleCount(prev => prev + data.domains.length)
    enqueue(data.domains)
  }

  const hasMore = visibleCount < filteredDomains.length
  const checkedCount = domains.filter((entry) => statuses[entry.domain] !== undefined).length
  const availableCount = availableDomains.length

  if (!searchTerm.trim() || !isValid) return null

  if (isExpanding) {
    return (
      <div className="mt-4">
        <div className="space-y-4">
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 bg-gray-50 rounded-md animate-pulse"></div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-500 font-light">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span>Generating domains...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (expandError) {
    return <div className="text-center text-red-500 text-sm py-4 font-light">Failed to generate domains. Please try again.</div>
  }

  if (domains.length === 0) {
    if (hasSearched) {
      return (
        <div className="space-y-4">
          <div className="text-center text-red-500 text-sm py-4 font-light">
            Your query returned 0 results.
          </div>
          <HowToSection />
        </div>
      )
    }
    return <HowToSection />
  }

  // Batch dividers mark where "Try More" appended results, which only makes
  // sense while the list is still in generated order.
  const showBatchDividers = sort === "original" && filter === "all"

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        <ResultControls
          filter={filter}
          onFilterChange={setFilter}
          sort={sort}
          onSortChange={setSort}
          availableCount={availableCount}
          totalCount={domains.length}
        />

        <div className="space-y-1">
          {visibleDomains.map((item, index) => {
            const previousItem = index > 0 ? visibleDomains[index - 1] : null
            const isFirstInBatch = Boolean(
              showBatchDividers && item.isNewBatch && (!previousItem || previousItem.batchId !== item.batchId)
            )
            const status = statuses[item.domain] ?? null

            return (
              <div
                key={item.domain}
                ref={(el) => setDomainRef(item.domain, el)}
                data-domain={item.domain}
                data-status={status ?? ''}
              >
                <DomainResult
                  domain={item.domain}
                  status={status}
                  isFirstNewBatch={isFirstInBatch}
                  showNewBatchDivider={isFirstInBatch}
                  isHighlighted={status === 'available' && !seenAvailableDomains.has(item.domain)}
                  isFadingOut={fadingDomains.has(item.domain)}
                  onMoreLikeThis={onSearch}
                />
              </div>
            )
          })}
        </div>

        {filter === "available" && availableCount === 0 && (
          <p className="py-4 text-center text-sm font-light text-gray-500">
            {isChecking ? "Still checking — no free names yet." : "None of these are available. Try More Suggestions below."}
          </p>
        )}

        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => setVisibleCount(prev => Math.min(prev + 20, filteredDomains.length))} className="text-sm font-light">
              Load More ({filteredDomains.length - visibleCount} remaining)
            </Button>
          </div>
        )}

        <div className="text-center text-sm text-gray-500 pt-2 font-light">
          {availableCount} available out of {checkedCount} checked
          {isChecking && (
            <span className="ml-2">
              <span className="inline-block animate-pulse">•</span> Still checking...
            </span>
          )}
        </div>

        {/* Try More button */}
        {domains.length > 0 && extractPatterns(searchTerm).length > 0 && !isExpandingMore && !isChecking && !hasMore && !tryMoreLimitReached && (
          <div className="flex flex-col items-center pt-6 space-y-2">
            <Button
              onClick={loadMoreDomains}
              className="font-light cursor-pointer"
              variant="default"
              disabled={isExpandingMore}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 opacity-70" />
              Try More Suggestions
            </Button>
            {tryMoreRemaining === 1 && (
              <p className="text-xs text-gray-400 font-light">Last try more attempt</p>
            )}
          </div>
        )}

        {isExpandingMore && (
          <div className="text-center text-sm text-gray-500 pt-4 font-light">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Generating more suggestions...
          </div>
        )}

        {/* Show message when try more limit is reached */}
        {domains.length > 0 && extractPatterns(searchTerm).length > 0 && !isExpandingMore && !isChecking && !hasMore && tryMoreLimitReached && (
          <div className="text-center text-sm text-gray-400 pt-6 font-light">
            No more unique domain suggestions available
          </div>
        )}
      </div>

      <AiPickPanel
        enabled={aiPickEnabled}
        onToggle={handleAiPickToggle}
        ranked={ranked}
        isLoading={isRanking}
        error={rankError}
        availableCount={availableCount}
        isChecking={isChecking}
        modelName={rankerModelName}
      />
    </div>
  )
}

export default function DomainGenerator({ rankerModelName }: { rankerModelName: string }) {
  const [searchTerm, setSearchTerm] = useQueryState('q', {
    defaultValue: '',
    shallow: false,
    throttleMs: 500, // Match the debounce delay for domain expansion
  })
  const [validation, setValidation] = useState<{ isValid: boolean; error: string | null }>({
    isValid: true,
    error: null,
  })

  const examplePatterns = [
    { label: "(two cybersecurity startup terms).ai", value: "(two cybersecurity startup terms).ai" },
    { label: "(action words)myapp.(com/io)", value: "(action words)myapp.(com/io)" },
    { label: "(one dictionary word).io", value: "(one dictionary word).io" },
  ]

  const validateAndSetSearchTerm = useCallback((query: string) => {
    const result = validateDomainQuery(query)
    setValidation(result)
    setSearchTerm(query)
  }, [setSearchTerm])

  // "More like this" reuses the pattern language: a style pattern seeded with a
  // name the user already liked, keeping whatever TLD it had.
  const searchSimilarTo = useCallback((domain: string) => {
    const [name, ...rest] = domain.split('.')
    const tld = rest.join('.')
    validateAndSetSearchTerm(`(names like ${name})${tld ? `.${tld}` : ''}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [validateAndSetSearchTerm])

  return (
    <div className="w-full space-y-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <HighlightedInput
          value={searchTerm}
          onChange={validateAndSetSearchTerm}
          placeholder="Enter domain query: example.com or (get/use)app.(com/io)"
          error={!!validation.error}
        />

        <ExamplePatterns
          patterns={examplePatterns}
          onSelect={validateAndSetSearchTerm}
        />

        {validation.error && <p className="text-sm text-red-500 font-light">{validation.error}</p>}
      </div>

      <DomainList
        searchTerm={searchTerm}
        isValid={validation.isValid}
        onSearch={searchSimilarTo}
        rankerModelName={rankerModelName}
      />
    </div>
  )
}
