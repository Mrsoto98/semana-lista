import { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white/5 border border-white/10 rounded-xl p-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
