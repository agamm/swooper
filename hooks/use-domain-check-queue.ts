import { useCallback, useEffect, useRef, useState } from 'react'
import { checkDomainAvailability } from '@/lib/api'
import type { DomainStatus } from '@/lib/domain-status'

// The browser used to mount one checker component per domain and fire all of
// them at once, which meant ~100 simultaneous requests for a single search.
// A bounded queue keeps the registries answering and the UI honest about
// how much work is left.
const DEFAULT_CONCURRENCY = 6

export interface DomainCheckQueue {
  statuses: Record<string, DomainStatus>
  remaining: number
  enqueue: (domains: string[]) => void
  reset: () => void
}

export function useDomainCheckQueue(concurrency: number = DEFAULT_CONCURRENCY): DomainCheckQueue {
  const [statuses, setStatuses] = useState<Record<string, DomainStatus>>({})
  const [remaining, setRemaining] = useState(0)

  const queueRef = useRef<string[]>([])
  const queuedRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  // A settled request refills the queue by calling pump again. Going through a
  // ref keeps that recursion out of pump's own initialiser.
  const pumpRef = useRef<() => void>(() => {})

  if (abortRef.current === null) {
    abortRef.current = new AbortController()
  }

  const pump = useCallback(() => {
    const controller = abortRef.current
    if (!controller) return

    while (inFlightRef.current < concurrency && queueRef.current.length > 0) {
      const domain = queueRef.current.shift()
      if (domain === undefined) break

      inFlightRef.current++

      checkDomainAvailability(domain, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setStatuses((prev) => ({ ...prev, [domain]: result.status }))
          }
        })
        .catch(() => {
          // A failed request tells us nothing about the domain. Recording it as
          // `unknown` also retires it from the queue, so the UI can stop
          // claiming it is still checking.
          if (!controller.signal.aborted) {
            setStatuses((prev) => ({ ...prev, [domain]: 'unknown' }))
          }
        })
        .finally(() => {
          inFlightRef.current--
          if (!controller.signal.aborted) {
            setRemaining((count) => Math.max(0, count - 1))
            pumpRef.current()
          }
        })
    }
  }, [concurrency])

  useEffect(() => {
    pumpRef.current = pump
  }, [pump])

  const enqueue = useCallback(
    (domains: string[]) => {
      const fresh = domains.filter((domain) => !queuedRef.current.has(domain))
      if (fresh.length === 0) return

      fresh.forEach((domain) => queuedRef.current.add(domain))
      queueRef.current.push(...fresh)
      setRemaining((count) => count + fresh.length)
      pump()
    },
    [pump],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    queueRef.current = []
    queuedRef.current.clear()
    inFlightRef.current = 0
    setStatuses({})
    setRemaining(0)
  }, [])

  useEffect(() => {
    const controller = abortRef.current
    return () => controller?.abort()
  }, [])

  return { statuses, remaining, enqueue, reset }
}
