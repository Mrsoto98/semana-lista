// src/components/ui/TagInput.tsx
import { useState, useRef } from 'react'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagInput({ tags, onChange, placeholder = 'Escribe y pulsa Enter...' }: Props) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const val = input.trim().toLowerCase().slice(0, 50)
    if (val && !tags.includes(val) && tags.length < 30) {
      onChange([...tags, val])
    }
    setInput('')
  }

  function remove(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !input && tags.length) {
      remove(tags[tags.length - 1])
    }
  }

  return (
    <div
      className="min-h-[44px] flex flex-wrap gap-1.5 items-center border rounded-card px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-600 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm"
          style={{ backgroundColor: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}
        >
          {tag}
          <button type="button" onClick={() => remove(tag)} className="hover:text-red-500 leading-none">&times;</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
      />
    </div>
  )
}
