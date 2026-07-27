"use client"

import { Sparkles } from "lucide-react"

interface ResultControlsProps {
  availableOnly: boolean
  onAvailableOnlyChange: (availableOnly: boolean) => void
  aiPickEnabled: boolean
  onAiPickChange: (enabled: boolean) => void
  availableCount: number
  totalCount: number
  isChecking: boolean
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-light transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  )
}

export function ResultControls({
  availableOnly,
  onAvailableOnlyChange,
  aiPickEnabled,
  onAiPickChange,
  availableCount,
  totalCount,
  isChecking,
}: ResultControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* The counts live here rather than in a separate footer line, which used
          to repeat them. */}
      <p className="text-xs font-light text-gray-400">
        {totalCount} {totalCount === 1 ? "name" : "names"} · {availableCount} available
        {isChecking && <span className="ml-1 animate-pulse">· checking…</span>}
      </p>

      <div className="flex items-center gap-2">
        <TogglePill active={availableOnly} onClick={() => onAvailableOnlyChange(!availableOnly)}>
          Available only
        </TogglePill>
        <TogglePill active={aiPickEnabled} onClick={() => onAiPickChange(!aiPickEnabled)}>
          <Sparkles className="h-3 w-3" />
          AI pick
        </TogglePill>
      </div>
    </div>
  )
}
