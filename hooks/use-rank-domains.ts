import { useEffect, useRef, useState } from 'react'
import { rankDomains } from '@/lib/api'
import type { RankedDomain } from '@/lib/rank-domains'

// Re-rank only once the availability sweep has settled, otherwise every result
// that lands would fire another model call.
export function useRankDomains(query: string, availableDomains: string[], enabled: boolean) {
  const [ranked, setRanked] = useState<RankedDomain[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ranking the same candidates twice would just spend tokens on an answer we
  // already have, so key the request on its inputs.
  const key = `${query}::${[...availableDomains].sort().join(',')}`
  const lastKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || availableDomains.length === 0) {
      setRanked([])
      setError(null)
      lastKeyRef.current = null
      return
    }

    if (lastKeyRef.current === key) return
    lastKeyRef.current = key

    const controller = new AbortController()

    const run = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await rankDomains(query, availableDomains, controller.signal)
        if (!controller.signal.aborted) setRanked(data.ranked ?? [])
      } catch (err) {
        if (!controller.signal.aborted) {
          setError('Could not rank these domains.')
          console.error('Error ranking domains:', err)
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    run()

    return () => controller.abort()
    // `key` already encodes query + candidates; listing them too would re-run
    // the effect on every array identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { ranked, isLoading, error }
}
