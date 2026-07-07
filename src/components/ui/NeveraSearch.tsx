// src/components/ui/NeveraSearch.tsx
import { useState, useRef, useEffect, useMemo } from 'react'

interface Producto {
  id: string
  nombre: string
  foto?: string
}

// Catálogo cargado una sola vez de forma lazy desde /public/mercadona.json
let catalogoCache: Producto[] | null = null
let cargando = false
const listeners: Array<() => void> = []

function cargarCatalogo() {
  if (catalogoCache || cargando) return
  cargando = true
  fetch('/mercadona.json')
    .then(r => r.json())
    .then((data: { categorias: Record<string, Producto[]> }) => {
      const vistos = new Set<string>()
      const lista: Producto[] = []
      for (const productos of Object.values(data.categorias)) {
        for (const p of productos) {
          const key = p.nombre.toLowerCase()
          if (!vistos.has(key)) { vistos.add(key); lista.push(p) }
        }
      }
      catalogoCache = lista
      cargando = false
      listeners.forEach(fn => fn())
      listeners.length = 0
    })
    .catch(() => { cargando = false })
}

function useCatalogo() {
  const [listo, setListo] = useState(!!catalogoCache)
  useEffect(() => {
    if (catalogoCache) { setListo(true); return }
    listeners.push(() => setListo(true))
    cargarCatalogo()
  }, [])
  return listo ? (catalogoCache ?? []) : []
}

interface Props {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}

export function NeveraSearch({ items, onChange, placeholder = 'Buscar en catálogo Mercadona...' }: Props) {
  const catalogo = useCatalogo()
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const sugerencias = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || catalogo.length === 0) return []
    return catalogo
      .filter(p => p.nombre.toLowerCase().includes(q) && !items.includes(p.nombre.toLowerCase()))
      .slice(0, 8)
  }, [query, items, catalogo])

  useEffect(() => {
    setAbierto(sugerencias.length > 0)
  }, [sugerencias])

  function agregar(nombre: string) {
    const val = nombre.toLowerCase()
    if (!items.includes(val) && items.length < 30) onChange([...items, val])
    setQuery('')
    setAbierto(false)
    inputRef.current?.focus()
  }

  function eliminar(item: string) {
    onChange(items.filter(i => i !== item))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      if (sugerencias.length > 0) agregar(sugerencias[0].nombre)
      else agregar(query.trim())
    } else if (e.key === 'Escape') {
      setAbierto(false)
    } else if (e.key === 'Backspace' && !query && items.length) {
      eliminar(items[items.length - 1])
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative">
      <div
        className="min-h-[44px] flex flex-wrap gap-1.5 items-center border rounded-card px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-600 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {items.map(item => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm"
            style={{ backgroundColor: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}
          >
            {item}
            <button type="button" onClick={() => eliminar(item)} className="hover:text-red-500 leading-none">&times;</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => { cargarCatalogo(); if (sugerencias.length > 0) setAbierto(true) }}
          placeholder={items.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[140px] outline-none bg-transparent text-sm"
          autoComplete="off"
        />
      </div>

      {abierto && sugerencias.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-card shadow-lg max-h-64 overflow-y-auto"
        >
          {sugerencias.map(p => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); agregar(p.nombre) }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left text-sm"
              >
                {p.foto && (
                  <img src={p.foto} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" loading="lazy" />
                )}
                <span className="truncate">{p.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
