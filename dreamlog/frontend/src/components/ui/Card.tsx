import { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass-card rounded-2xl p-5', className)} {...props}>
      {children}
    </div>
  )
}
