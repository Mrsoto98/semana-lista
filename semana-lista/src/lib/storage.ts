// src/lib/storage.ts
const PREFIX = 'semana-lista:'

export function guardar<T>(clave: string, valor: T): void {
  try {
    localStorage.setItem(PREFIX + clave, JSON.stringify(valor))
  } catch {
    // storage full or private mode — silently ignore
  }
}

export function recuperar<T>(clave: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + clave)
    return raw !== null ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function borrar(clave: string): void {
  localStorage.removeItem(PREFIX + clave)
}
