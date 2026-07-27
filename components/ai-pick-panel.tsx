"use client"

import { Trophy } from "lucide-react"
import type { RankedDomain } from "@/lib/rank-domains"

interface AiPickPanelProps {
  ranked: RankedDomain[]
  isLoading: boolean
  error: string | null
  modelName: string
}

/**
 * Renders nothing until it has something to say. The toggle that controls it
 * lives in the results toolbar, so an empty panel is never worth a column.
 */
export function AiPickPanel({ ranked, isLoading, error, modelName }: AiPickPanelProps) {
  if (isLoading) {
    return (
      <aside className="self-start lg:sticky lg:top-8" aria-live="polite">
        <div className="h-24 animate-pulse rounded-lg bg-gray-50" />
      </aside>
    )
  }

  if (error) {
    return (
      <aside className="self-start lg:sticky lg:top-8">
        <p className="text-xs font-light text-red-500">{error}</p>
      </aside>
    )
  }

  const [best, ...runnersUp] = ranked
  if (!best) return null

  return (
    <aside className="self-start lg:sticky lg:top-8 space-y-3 rounded-lg border border-purple-100 bg-purple-50/50 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-normal text-purple-600">
        <Trophy className="h-3 w-3" />
        Best pick
      </div>

      <div>
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

      {/* Runners-up are names only. Each carried its own paragraph before, which
          buried the one recommendation this panel exists to make. */}
      {runnersUp.length > 0 && (
        <div className="border-t border-purple-100 pt-2">
          <p className="mb-1 text-[11px] font-light text-gray-400">Then</p>
          <ul className="space-y-0.5">
            {runnersUp.map((item) => (
              <li key={item.domain}>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(item.domain)}
                  title="Click to copy"
                  className="cursor-pointer text-xs font-light break-all text-gray-600 hover:text-purple-700"
                >
                  {item.domain}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] font-light text-gray-400">Ranked by {modelName}</p>
    </aside>
  )
}
