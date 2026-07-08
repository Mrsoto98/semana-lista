import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs text-white/50 font-medium uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full glass-input rounded-xl px-4 py-2.5 text-white placeholder:text-white/25 text-sm',
            error && 'border-red-400/50 focus:border-red-400/80',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400/80">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
