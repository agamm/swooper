"use client"

export type ResultFilter = "all" | "available"
export type ResultSort = "best" | "original"

interface ResultControlsProps {
  filter: ResultFilter
  onFilterChange: (filter: ResultFilter) => void
  sort: ResultSort
  onSortChange: (sort: ResultSort) => void
  availableCount: number
  totalCount: number
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-light text-gray-400">{label}</span>
      <div role="group" aria-label={label} className="flex rounded-md border border-gray-200 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded px-2 py-0.5 text-xs font-light transition-colors ${
              value === option.value ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ResultControls({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  availableCount,
  totalCount,
}: ResultControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Segmented
        label="Show"
        value={filter}
        onChange={onFilterChange}
        options={[
          { value: "all", label: `All ${totalCount}` },
          { value: "available", label: `Available ${availableCount}` },
        ]}
      />
      <Segmented
        label="Sort"
        value={sort}
        onChange={onSortChange}
        options={[
          { value: "best", label: "Best first" },
          { value: "original", label: "Generated" },
        ]}
      />
    </div>
  )
}
