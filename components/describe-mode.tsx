"use client"

import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MAX_SUGGESTIONS, type PatternSuggestion } from "@/lib/suggest-patterns"

interface DescribeModeProps {
  brief: string
  onBriefChange: (brief: string) => void
  onSubmit: () => void
  patterns: PatternSuggestion[]
  isLoading: boolean
  error: string | null
  /** The pattern currently showing results below, if any. */
  activePattern: string | null
  onPickPattern: (pattern: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

const PLACEHOLDER = `I'm building a tool that helps small landlords track maintenance requests from tenants. It should feel practical and calm rather than techy — closer to a well-run building than a startup. Short is better than clever.`

// Highlight the parenthesised slots the way the main input does, so a pattern
// reads the same wherever it appears.
function PatternText({ pattern }: { pattern: string }) {
  return (
    <>
      {pattern.split(/(\([^)]*\))/g).map((part, index) =>
        part.startsWith("(") && part.endsWith(")") ? (
          <span key={index} className="rounded bg-purple-100 text-purple-700">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

export function DescribeMode({
  brief,
  onBriefChange,
  onSubmit,
  patterns,
  isLoading,
  error,
  activePattern,
  onPickPattern,
  collapsed,
  onToggleCollapsed,
}: DescribeModeProps) {
  const canSubmit = brief.trim().length > 0 && !isLoading

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Once results are showing, the brief folds away but is never discarded —
          reopening it gets the original text back for editing. */}
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-left transition-colors hover:border-gray-300"
        >
          <span className="truncate text-xs font-light text-gray-500">{brief}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-light text-gray-400">
            Edit
            <ChevronDown className="h-3 w-3" />
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="brief" className="block text-sm font-light text-gray-500">
              Describe what you&apos;re building and the kind of name you want.
            </label>
            {patterns.length > 0 && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="flex shrink-0 cursor-pointer items-center gap-1 text-xs font-light text-gray-400 hover:text-gray-600"
              >
                Hide
                <ChevronUp className="h-3 w-3" />
              </button>
            )}
          </div>
          <textarea
            id="brief"
            value={brief}
            onChange={(e) => onBriefChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter alone should still make paragraphs.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onSubmit()
            }}
            rows={5}
            maxLength={2000}
            placeholder={PLACEHOLDER}
            className="w-full resize-y rounded-md border border-input px-3 py-2 text-sm font-light placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-light text-gray-400">⌘↵ to submit</span>
            <Button onClick={onSubmit} disabled={!canSubmit} className="cursor-pointer font-light">
              {isLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                  {patterns.length > 0 ? "Suggest again" : "Suggest patterns"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm font-light text-red-500">{error}</p>}

      {isLoading && patterns.length === 0 && (
        <div className="space-y-2" aria-live="polite">
          {Array.from({ length: MAX_SUGGESTIONS }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-md bg-gray-50" />
          ))}
        </div>
      )}

      {patterns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-light text-gray-400">
            {patterns.length} {patterns.length === 1 ? "angle" : "different angles"} —{" "}
            {activePattern ? "pick another to switch results." : "pick one to search it."}
          </p>
          <ul className="space-y-2">
            {patterns.map((suggestion) => {
              const isActive = suggestion.pattern === activePattern

              return (
                <li key={suggestion.pattern}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onPickPattern(suggestion.pattern)}
                    className={`group w-full cursor-pointer rounded-md border p-3 text-left transition-colors focus-visible:outline-none ${
                      isActive
                        ? "border-purple-400 bg-purple-50/60"
                        : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 focus-visible:border-purple-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-light break-all text-gray-800">
                        <PatternText pattern={suggestion.pattern} />
                      </span>
                      {isActive && (
                        <span className="mt-0.5 shrink-0 text-[11px] font-normal text-purple-600">Showing</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-light text-gray-500">{suggestion.angle}</p>
                    {suggestion.examples.length > 0 && !isActive && (
                      <p className="mt-1.5 text-xs font-light text-gray-400">
                        e.g. {suggestion.examples.join(" · ")}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {!activePattern && (
            <p className="text-[11px] font-light text-gray-400">
              Examples show the shape of each pattern — availability is only checked once you pick one.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
