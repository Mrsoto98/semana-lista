// src/components/ui/ProgressBar.tsx
interface Props {
  value: number
  max: number
  label?: string
}

export function ProgressBar({ value, max, label }: Props) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="space-y-1">
      {label && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {label} — {value}/{max}
        </p>
      )}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-select rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
