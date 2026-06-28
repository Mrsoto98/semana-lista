// src/components/ui/Skeleton.tsx
interface Props {
  className?: string
  lines?: number
}

export function Skeleton({ className = '', lines = 1 }: Props) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Cargando...">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-200 dark:bg-gray-700 rounded skeleton-pulse"
          style={{ height: '1rem', width: i === lines - 1 && lines > 1 ? '66%' : '100%' }}
        />
      ))}
    </div>
  )
}
