"use client"

import { Sparkles, Trophy } from "lucide-react"
import type { RankedDomain } from "@/lib/rank-domains"

interface AiPickPanelProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  ranked: RankedDomain[]
  isLoading: boolean
  error: string | null
  availableCount: number
  isChecking: boolean
  modelName: string
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <aside className="lg:sticky lg:top-8 rounded-lg border border-gray-200 bg-white/60 p-4">
      {children}
    </aside>
  )
}

function Header({ enabled, onToggle }: { enabled: boolean; onToggle: (enabled: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-normal text-gray-700">
        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
        AI pick
      </h2>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Rank available domains with AI"
        onClick={() => onToggle(!enabled)}
        className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 ${
          enabled ? "bg-purple-500" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  )
}

export function AiPickPanel({
  enabled,
  onToggle,
  ranked,
  isLoading,
  error,
  availableCount,
  isChecking,
  modelName,
}: AiPickPanelProps) {
  const [best, ...runnersUp] = ranked

  const body = () => {
    if (!enabled) {
      return <p className="text-xs font-light text-gray-500">Turn on to have {modelName} rank the available names and explain its favourite.</p>
    }

    if (availableCount === 0) {
      return (
        <p className="text-xs font-light text-gray-500">
          {isChecking ? "Waiting for availability results…" : "No available domains to rank yet."}
        </p>
      )
    }

    // Ranking a moving target wastes calls, so it waits for the sweep to finish.
    if (isChecking) {
      return <p className="text-xs font-light text-gray-500">Checking availability first… ({availableCount} free so far)</p>
    }

    if (isLoading) {
      return (
        <div className="space-y-2" aria-live="polite">
          <div className="h-16 animate-pulse rounded-md bg-gray-100" />
          <div className="h-8 animate-pulse rounded-md bg-gray-50" />
          <div className="h-8 animate-pulse rounded-md bg-gray-50" />
        </div>
      )
    }

    if (error) {
      return <p className="text-xs font-light text-red-500">{error}</p>
    }

    if (!best) {
      return <p className="text-xs font-light text-gray-500">No ranking available.</p>
    }

    return (
      <div className="space-y-3">
        <div className="rounded-md border border-purple-100 bg-purple-50/60 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-normal text-purple-600">
            <Trophy className="h-3 w-3" />
            Best pick
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(best.domain)}
            title="Click to copy"
            className="cursor-pointer text-sm font-normal break-all text-gray-800 hover:text-purple-700"
          >
            {best.domain}
          </button>
          <p className="mt-1 text-xs font-light leading-snug text-gray-600">{best.reason}</p>
        </div>

        {runnersUp.length > 0 && (
          <ol className="space-y-2">
            {runnersUp.map((item, index) => (
              <li key={item.domain} className="flex gap-2">
                <span className="mt-0.5 w-3 shrink-0 text-[11px] font-light text-gray-400">{index + 2}</span>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(item.domain)}
                    title="Click to copy"
                    className="cursor-pointer text-xs font-normal break-all text-gray-700 hover:text-purple-700"
                  >
                    {item.domain}
                  </button>
                  <p className="text-[11px] font-light leading-snug text-gray-500">{item.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="text-[10px] font-light text-gray-400">Ranked by {modelName}</p>
      </div>
    )
  }

  return (
    <Shell>
      <Header enabled={enabled} onToggle={onToggle} />
      <div className="mt-3">{body()}</div>
    </Shell>
  )
}
