# Semana Lista — 5 Mejoras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 features to the Semana Lista React app: recipe step viewer modal, "bought" checkbox in shopping list, lazy Mercadona catalog loading, per-day regenerate button, and auto-match menu ingredients to Mercadona prices.

**Architecture:** All changes are isolated to 3 files (RecetaCard.tsx, Lista.tsx, Menu.tsx) plus the Supabase edge function. No new files needed. The edge function gets a new `action: 'pasos'` branch before existing dia/franja logic.

**Tech Stack:** React 18, TypeScript, Vite, TailwindCSS, Supabase JS client, Deno edge functions, Groq API

## Global Constraints

- Working directory: `C:\CLAUDE SKIL\semana-lista`
- Do NOT run `npm run dev` or start a dev server
- Do NOT modify `tsconfig.app.json` or `package.json`
- `guardar(key, value)` and `recuperar<T>(key): T | null` from `../lib/storage`
- Supabase client exported as `{ supabase }` from `../lib/supabase`
- `CatalogoMercadonaData` and `ProductoMercadona` types defined in Lista.tsx
- After all tasks: run `npm run build` in `C:\CLAUDE SKIL\semana-lista` and fix TS errors
- After build: deploy edge function: `npx supabase functions deploy generar-recetas --project-ref npdmsjvchiqpleqzpgtr`

---

### Task 1: Edge function — `pasos` mode

**Files:**
- Modify: `supabase/functions/generar-recetas/index.ts` (lines 78-133, the `Deno.serve` handler)

**Interfaces:**
- Consumes: existing `llamarGroq(prompt, maxTokens)` helper already in the file
- Produces: new branch that handles `{ action: 'pasos', nombre: string, ingredientes: Ingrediente[], descripcion: string }` → returns `{ pasos: string[] }`

- [ ] **Step 1: Add the `pasos` branch in `Deno.serve` handler**

In `supabase/functions/generar-recetas/index.ts`, inside the `try` block of `Deno.serve`, BEFORE the existing `if (dia && franja)` check (line 87), insert:

```typescript
    // Modo pasos: generar pasos de cocina para una receta
    if (body.action === 'pasos') {
      const { nombre, ingredientes, descripcion } = body as {
        nombre: string
        ingredientes: Array<{ nombre: string; cantidad: number; unidad: string }>
        descripcion: string
      }
      const ingStr = ingredientes.map((i: { nombre: string; cantidad: number; unidad: string }) => `${i.cantidad} ${i.unidad} ${i.nombre}`).join(', ')
      const prompt = `Escribe los pasos de cocina numerados para: ${nombre}. Ingredientes: ${ingStr}. ${descripcion}. Solo JSON: {"pasos":["1. ...","2. ...",...]}. Máximo 6 pasos concisos.`
      const raw = await llamarGroq(prompt, 400)
      const parsed = JSON.parse(raw)
      return new Response(
        JSON.stringify({ pasos: parsed.pasos ?? [] }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }
```

- [ ] **Step 2: Verify the file looks correct**

The handler flow should now be:
1. OPTIONS → return ok
2. non-POST → 405
3. try:
   a. parse body
   b. if `body.action === 'pasos'` → call llamarGroq with pasos prompt, return `{ pasos: [...] }`
   c. if `dia && franja` → slot mode
   d. else → semana completa mode
4. catch → error JSON

- [ ] **Step 3: Commit**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
git add supabase/functions/generar-recetas/index.ts
git commit -m "feat: edge function pasos mode for recipe steps"
```

---

### Task 2: RecetaCard — "Ver receta" modal

**Files:**
- Modify: `src/components/RecetaCard.tsx`

**Interfaces:**
- Consumes: `supabase.functions.invoke('generar-recetas', { body: { action: 'pasos', nombre, ingredientes, descripcion } })` → `{ data: { pasos: string[] } }`
- Produces: visual modal in-component, no new exports

- [ ] **Step 1: Add state variables inside `RecetaCard` component**

After the existing `const [vista, setVista] = useState(seleccionada)` (line 28), add:

```typescript
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pasos, setPasos] = useState<string[] | null>(null)
  const [cargandoPasos, setCargandoPasos] = useState(false)
```

- [ ] **Step 2: Add the `verReceta` async function**

After the new state declarations, add:

```typescript
  async function verReceta(e: React.MouseEvent) {
    e.stopPropagation()
    setModalAbierto(true)
    if (pasos) return // already fetched
    setCargandoPasos(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.functions.invoke('generar-recetas', {
        body: { action: 'pasos', nombre: receta.nombre, ingredientes: receta.ingredientes, descripcion: receta.descripcion_corta },
      })
      setPasos((data as { pasos: string[] })?.pasos ?? [])
    } catch {
      setPasos([])
    } finally {
      setCargandoPasos(false)
    }
  }
```

- [ ] **Step 3: Add "Ver receta" button below badges row**

In the JSX, after the `<div className="flex items-center gap-2 flex-wrap">` badges div (which closes at line 74), add:

```tsx
        <div className="mt-2">
          <button
            onClick={verReceta}
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            📖 Ver receta
          </button>
        </div>
```

- [ ] **Step 4: Add modal JSX**

After the closing `</div>` of the card's inner `<div className="p-3">` (before the `{opciones.length > 1 && ...}` section, line 77), add:

```tsx
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalAbierto(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-bold text-base leading-tight pr-2">{receta.nombre}</h2>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{receta.descripcion_corta}</p>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Ingredientes</h3>
            <ul className="space-y-1 mb-4">
              {receta.ingredientes.map((ing, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                  {ing.cantidad} {ing.unidad} {ing.nombre}
                </li>
              ))}
            </ul>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Pasos</h3>
            {cargandoPasos ? (
              <p className="text-sm text-gray-400 animate-pulse">Generando pasos...</p>
            ) : pasos && pasos.length > 0 ? (
              <ol className="space-y-2">
                {pasos.map((paso, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{paso}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">No se pudieron cargar los pasos.</p>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Commit**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
git add src/components/RecetaCard.tsx
git commit -m "feat: ver receta modal with fetched cooking steps"
```

---

### Task 3: Lista — "Comprado" checkbox state

**Files:**
- Modify: `src/pages/Lista.tsx`

**Interfaces:**
- Consumes: `guardar`, `recuperar` from `../lib/storage` (already imported)
- Produces: `comprado: Set<string>` state, `saveComprado(next)` function, UI changes in comprar list

- [ ] **Step 1: Add `comprado` state after existing state declarations**

After `const [customItems, setCustomItems] = useState(...)` (line 31), add:

```typescript
  const [comprado, setComprado] = useState<Set<string>>(() => new Set(recuperar<string[]>('lista_comprado') ?? []))
```

- [ ] **Step 2: Add `saveComprado` helper**

After the `saveCustom` function (line 49), add:

```typescript
  function saveComprado(next: Set<string>) { setComprado(next); guardar('lista_comprado', Array.from(next)) }
```

- [ ] **Step 3: Update `addToCasa` to remove from comprado**

Find the existing `addToCasa` function (lines 58-62). Replace with:

```typescript
  function addToCasa(nombre: string) {
    const n = new Set(enCasa); n.add(nombre)
    const c = new Set(comprar); c.delete(nombre)
    const cp = new Set(comprado); cp.delete(nombre)
    saveCasa(n); saveComprar(c); saveComprado(cp)
  }
```

- [ ] **Step 4: Update the total to exclude comprado items**

Find line 108: `const totalEstimado = comprarArray.reduce((s, item) => s + (precios[item] ?? 0), 0)`

Replace with:

```typescript
  const totalEstimado = comprarArray.filter(item => !comprado.has(item)).reduce((s, item) => s + (precios[item] ?? 0), 0)
```

- [ ] **Step 5: Update the comprar list items to show checkbox + strike-through**

Find the list item render inside `comprarArray.map(item => ...)` (starting line 149). Replace the entire inner `<div key={item} ...>` with:

```tsx
                  <div key={item} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${comprado.has(item) ? 'bg-gray-50 dark:bg-gray-900' : 'bg-green-50 dark:bg-green-950'}`}>
                    <input
                      type="checkbox"
                      checked={comprado.has(item)}
                      onChange={() => {
                        const cp = new Set(comprado)
                        if (cp.has(item)) cp.delete(item); else cp.add(item)
                        saveComprado(cp)
                      }}
                      className="shrink-0 accent-green-500"
                    />
                    <span className={`flex-1 text-sm truncate ${comprado.has(item) ? 'line-through text-gray-400' : 'text-green-800 dark:text-green-200'}`}>{item}</span>

                    {/* Precio editable */}
                    {editandoPrecio === item ? (
                      <form onSubmit={e => { e.preventDefault(); guardarPrecio(item) }} className="flex gap-1 items-center shrink-0">
                        <input autoFocus type="number" step="0.01" min="0" value={precioEdit}
                          onChange={e => setPrecioEdit(e.target.value)}
                          className="w-20 text-xs border rounded px-2 py-0.5 dark:bg-gray-800" placeholder="0.00" />
                        <button type="submit" className="text-xs text-green-600 font-bold">✓</button>
                        <button type="button" onClick={() => setEditandoPrecio(null)} className="text-xs text-gray-400">✕</button>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setEditandoPrecio(item)
                          setPrecioEdit(precios[item]?.toString() ?? precioSugerido(item)?.toString() ?? '')
                        }}
                        className="text-xs text-gray-400 hover:text-green-600 shrink-0 min-w-[52px] text-right">
                        {precios[item] ? `${precios[item].toFixed(2)} €` : <span className="text-gray-300">+ precio</span>}
                      </button>
                    )}

                    <button onClick={() => addToCasa(item)} title="Tengo esto en casa" className="text-base shrink-0">🏠</button>
                    <button onClick={() => removeComprar(item)} className="text-gray-400 hover:text-red-500 shrink-0">✕</button>
                  </div>
```

- [ ] **Step 6: Add "Limpiar comprados" button below the list**

After the closing `</div>` of the `max-h-48 overflow-y-auto` div (after the comprarArray map, around line 178), but still inside the outer conditional, add a new line before the closing paren/tag of the `comprarArray.length === 0 ? ... : (...)` ternary:

```tsx
              {comprado.size > 0 && (
                <button
                  onClick={() => {
                    const cp = new Set(comprado)
                    const c = new Set(comprar)
                    cp.forEach(item => c.delete(item))
                    cp.clear()
                    saveComprar(c)
                    saveComprado(cp)
                  }}
                  className="w-full text-xs text-red-500 hover:text-red-700 py-1 mt-1 border border-red-200 rounded-lg"
                >
                  Limpiar comprados ({comprado.size})
                </button>
              )}
```

- [ ] **Step 7: Commit**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
git add src/pages/Lista.tsx
git commit -m "feat: comprado checkbox with strike-through and clear button"
```

---

### Task 4: Lista — Lazy Mercadona catalog

**Files:**
- Modify: `src/pages/Lista.tsx`

**Interfaces:**
- Produces: `MERCADONA` becomes `useState<CatalogoMercadonaData | null>(null)` instead of module-level const; `CATEGORIAS_MERCADONA` and `TODOS_LOS_PRODUCTOS` become `useMemo`

- [ ] **Step 1: Remove static imports and module-level consts**

Remove lines 6-22 from Lista.tsx:
```typescript
import catalogoMercadonaJson from '../data/mercadona.json'
```
and lines 17-22:
```typescript
const MERCADONA = catalogoMercadonaJson as CatalogoMercadonaData
const CATEGORIAS_MERCADONA = Object.keys(MERCADONA.categorias)
const TODO_CAT = 'Todo'

// Todos los productos en un array plano (para la categoría "Todo")
const TODOS_LOS_PRODUCTOS: ProductoMercadona[] = Object.values(MERCADONA.categorias).flat()
```
Keep `TODO_CAT` by adding it back as a constant outside the component after the interface definitions:
```typescript
const TODO_CAT = 'Todo'
```

- [ ] **Step 2: Update the import line at the top of the file**

The file starts with:
```typescript
import { useState, useMemo } from 'react'
```
Add `useEffect` to that import:
```typescript
import { useState, useMemo, useEffect } from 'react'
```

- [ ] **Step 3: Add `MERCADONA` state inside the component**

After `const { perfil } = usePerfil()` (first line of the component body), add:

```typescript
  const [MERCADONA, setMERCADONA] = useState<CatalogoMercadonaData | null>(null)
  useEffect(() => {
    import('../data/mercadona.json').then(m => setMERCADONA(m.default as CatalogoMercadonaData))
  }, [])
```

- [ ] **Step 4: Add `CATEGORIAS_MERCADONA` and `TODOS_LOS_PRODUCTOS` as useMemo**

After the new state, add:

```typescript
  const CATEGORIAS_MERCADONA = useMemo(() => MERCADONA ? Object.keys(MERCADONA.categorias) : [], [MERCADONA])
  const TODOS_LOS_PRODUCTOS = useMemo<ProductoMercadona[]>(() => MERCADONA ? Object.values(MERCADONA.categorias).flat() : [], [MERCADONA])
```

- [ ] **Step 5: Fix `sinCatalogo` check**

Find the existing line:
```typescript
  const sinCatalogo = CATEGORIAS_MERCADONA.length === 0
```
Replace with:
```typescript
  const sinCatalogo = MERCADONA !== null && CATEGORIAS_MERCADONA.length === 0
```

- [ ] **Step 6: Fix `productosVisibles` useMemo to handle null MERCADONA**

Find the `productosVisibles` useMemo (lines 94-104). Replace with:

```typescript
  const productosVisibles = useMemo(() => {
    if (!MERCADONA) return []
    const base = catActiva === TODO_CAT ? TODOS_LOS_PRODUCTOS : (MERCADONA.categorias[catActiva] ?? [])
    if (!busqueda || busqueda.length < 2) return base
    const q = busqueda.toLowerCase()
    const palabras = q.split(/\s+/).filter(Boolean)
    return base.filter(p => {
      const n = p.nombre.toLowerCase()
      return palabras.every((w: string) => n.includes(w))
    })
  }, [catActiva, busqueda, MERCADONA, TODOS_LOS_PRODUCTOS])
```

- [ ] **Step 7: Fix `precioSugerido` to handle null MERCADONA**

Find `function precioSugerido` (lines 113-119). Replace with:

```typescript
  function precioSugerido(nombre: string): number | undefined {
    if (!MERCADONA) return undefined
    for (const prods of Object.values(MERCADONA.categorias)) {
      const p = prods.find(p => p.nombre === nombre)
      if (p) return p.precio
    }
    return undefined
  }
```

- [ ] **Step 8: Add loading spinner in Mercadona catalog section**

In the JSX, inside the Mercadona section, find where `sinCatalogo ? (...)` is checked (around line 249). Before that conditional, add a check for null MERCADONA. The Mercadona section currently starts with `<div>` with `h2` title. After the `h2`/`span` row and before `{sinCatalogo ? (` add:

```tsx
          {MERCADONA === null ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <span className="animate-spin">⏳</span> Cargando catálogo...
            </div>
          ) : sinCatalogo ? (
```
And close that with an extra `)` — so the structure becomes `{MERCADONA === null ? (...) : sinCatalogo ? (...) : (...)}`.

Close the Mercadona section's outer `<div>` (currently after the `</>` of the `sinCatalogo` ternary).

Note: also update the Mercadona header span to guard on MERCADONA:
```tsx
            {MERCADONA?.actualizado && (
              <span className="text-xs text-gray-400">
                {new Date(MERCADONA.actualizado).toLocaleDateString('es-ES')} · {MERCADONA.total_productos} productos
              </span>
            )}
```

- [ ] **Step 9: Commit**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
git add src/pages/Lista.tsx
git commit -m "feat: lazy load Mercadona catalog with loading spinner"
```

---

### Task 5: Menu — "Regenerar día" button

**Files:**
- Modify: `src/pages/Menu.tsx`

**Interfaces:**
- Consumes: existing `regenerarSlot(dia: Dia, franja: Franja)` function (already in the file)
- Produces: new `regenerarDia(dia: Dia)` function; small 🔄 button next to each day label

- [ ] **Step 1: Add `regenerarDia` function**

After the `regenerarSlot` function definition (ends around line 144), add:

```typescript
  async function regenerarDia(dia: Dia) {
    await Promise.all([regenerarSlot(dia, 'comida'), regenerarSlot(dia, 'cena')])
  }
```

- [ ] **Step 2: Update the day label in the grid**

Find the day header in the JSX (line 407):
```tsx
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{DIAS_LABEL[dia]}</h2>
```

Replace with:
```tsx
            <div className="flex items-center mb-2">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300">{DIAS_LABEL[dia]}</h2>
              <button
                onClick={() => regenerarDia(dia)}
                disabled={generando}
                title={`Regenerar ${DIAS_LABEL[dia]}`}
                className="text-xs text-gray-400 hover:text-gray-600 ml-2 disabled:opacity-40"
              >
                🔄
              </button>
            </div>
```

- [ ] **Step 3: Commit**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
git add src/pages/Menu.tsx
git commit -m "feat: regenerar día button in menu grid"
```

---

### Task 6: Lista — Auto-match menu ingredients to Mercadona

**Files:**
- Modify: `src/pages/Lista.tsx`

**Interfaces:**
- Consumes: `MERCADONA` state (from Task 4), `addToComprar(nombre, precio?)` (already takes optional price)
- Produces: `buscarEnMercadona(nombre)` helper; auto-fills price when clicking 🛒 on menu ingredients

- [ ] **Step 1: Add `buscarEnMercadona` helper function**

Inside the component, after `precioSugerido` function, add:

```typescript
  function buscarEnMercadona(nombre: string): { nombre: string; precio: number } | undefined {
    if (!MERCADONA) return undefined
    const palabras = nombre.toLowerCase().split(/\s+/).filter(Boolean)
    let mejorProducto: ProductoMercadona | undefined
    let mejorScore = 0
    for (const prods of Object.values(MERCADONA.categorias)) {
      for (const prod of prods) {
        const n = prod.nombre.toLowerCase()
        const score = palabras.filter(w => n.includes(w)).length
        if (score > mejorScore) {
          mejorScore = score
          mejorProducto = prod
        }
      }
    }
    return mejorScore >= 1 ? mejorProducto : undefined
  }
```

- [ ] **Step 2: Update the 🛒 click handler in "Del menú esta semana"**

Find the 🛒 button in `ingredientesMenu.map(item => ...)` (around line 223):
```tsx
                    <button onClick={() => enC ? removeComprar(item) : addToComprar(item, precioSugerido(item))}
```

Replace with:
```tsx
                    <button onClick={() => enC ? removeComprar(item) : addToComprar(item, buscarEnMercadona(item)?.precio)}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
git add src/pages/Lista.tsx
git commit -m "feat: auto-match menu ingredients to Mercadona prices"
```

---

### Task 7: Build and deploy

**Files:**
- No code changes — build validation + edge function deploy

- [ ] **Step 1: Run TypeScript build**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
npm run build
```

Expected: exits 0 with no TypeScript errors. If there are errors, fix them in the relevant file before proceeding.

- [ ] **Step 2: Deploy edge function**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
npx supabase functions deploy generar-recetas --project-ref npdmsjvchiqpleqzpgtr
```

Expected: "Deployed Functions generar-recetas" or similar success message.

- [ ] **Step 3: Final commit if any build fixes were needed**

```bash
cd "C:\CLAUDE SKIL\semana-lista"
git add -p
git commit -m "fix: TypeScript build errors after 5 improvements"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] Task 1: edge function `pasos` mode — `action: 'pasos'` branch before dia/franja check, max_tokens 400, returns `{ pasos: string[] }`
   - [x] Task 2: RecetaCard modal with pasos fetch, stop propagation, ingredients list, close button
   - [x] Task 3: `comprado` Set persisted in `lista_comprado`, checkbox, strike-through, "Limpiar comprados (N)" button, total excludes comprado, addToCasa clears comprado
   - [x] Task 4: lazy import, useState for MERCADONA, useEffect on mount, useMemo for CATEGORIAS and TODOS, loading spinner, sinCatalogo guard
   - [x] Task 5: `regenerarDia` with Promise.all, 🔄 button disabled when `generando`
   - [x] Task 6: `buscarEnMercadona` word-score matcher min score 1, passes price to `addToComprar`

2. **Placeholder scan:** No TBDs or vague steps — all steps include actual code.

3. **Type consistency:**
   - `CatalogoMercadonaData` and `ProductoMercadona` are already defined in Lista.tsx and used consistently.
   - `Dia` type imported from `../types` in Menu.tsx — `regenerarDia(dia: Dia)` is consistent.
   - `supabase.functions.invoke` dynamic import pattern matches what Menu.tsx already uses.
