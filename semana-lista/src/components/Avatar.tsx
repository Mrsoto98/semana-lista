interface AvatarProps {
  url?: string | null
  emoji?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  sm: 'w-7 h-7 text-base',
  md: 'w-10 h-10 text-xl',
  lg: 'w-14 h-14 text-3xl',
  xl: 'w-20 h-20 text-4xl',
}

export function Avatar({ url, emoji, size = 'md', className = '' }: AvatarProps) {
  const base = `${SIZES[size]} rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-green-100 dark:bg-green-900 border-2 border-white dark:border-gray-800 ${className}`

  if (url) {
    return (
      <div className={base}>
        <img src={url} alt="avatar" className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={base}>
      {emoji ?? '🧑'}
    </div>
  )
}
