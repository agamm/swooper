import { useCallback, useRef, useState } from 'react'
import { suggestPatterns as requestSuggestions } from '@/lib/api'
import type { PatternSuggestion } from '@/lib/suggest-patterns'

export function useSuggestPatterns() {
  const [patterns, setPatterns] = useState<PatternSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Explicitly triggered rather than reactive: this is a deliberate, paid
  // action, so it fires on submit and never on keystroke.
  const abortRef = useRef<AbortController | null>(null)

  const suggest = useCallback(async (brief: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const data = await requestSuggestions(brief, controller.signal)
      if (controller.signal.aborted) return

      setPatterns(data.patterns ?? [])
      if ((data.patterns ?? []).length === 0) {
        setError('Could not turn that into a pattern. Try describing the product and the feel you want.')
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to suggest patterns')
      console.error('Error suggesting patterns:', err)
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setPatterns([])
    setError(null)
    setIsLoading(false)
  }, [])

  return { patterns, isLoading, error, suggest, clear }
}
