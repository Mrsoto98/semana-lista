# Semana Lista — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first weekly menu planner that generates AI recipes via Claude, prices them with real Mercadona data, and exports a shopping list with total cost.

**Architecture:** React+Vite frontend makes 14 parallel calls to a `generar-recetas` Supabase Edge Function (Deno) which calls Claude with structured JSON output. A second Edge Function `precios-mercadona` looks up ingredient prices through a three-layer cache (DB mapping → DB cache → live Mercadona API). All secret keys live exclusively in Edge Functions.

**Tech Stack:** React 18, Vite 5, TypeScript 5, TailwindCSS 3, Supabase JS v2, Supabase Edge Functions (Deno), `@anthropic-ai/sdk` (npm specifier in Deno), `react-router-dom` v6, `jsPDF` + `html2canvas`, `@supabase/supabase-js`.

## Global Constraints

- `ANTHROPIC_API_KEY` and all Mercadona HTTP calls live **only** in Edge Functions — never in `VITE_*` env vars or frontend code.
- Model: `claude-haiku-4-5-20251001` for recipe generation (no substitutions).
- Structured outputs API shape: `output_config: { format: { type: "json_schema", schema: {...} } }` — do **not** use deprecated `output_format`.
- Dark mode via `class="dark"` on `<html>` (Tailwind `darkMode: 'class'`).
- `localStorage` key prefix: `semana-lista:` for all persisted flow state.
- All DB access from the frontend uses the `anon` key — Edge Functions use the `service_role` key for admin writes to shared tables.
- Packaging math: `envases_a_comprar = Math.ceil(cantidad_necesaria / tamaño_envase)`, `coste_real = envases_a_comprar * precio_envase`. Never invent prices — use `sin_precio: true`.
- Project root: `semana-lista/` inside the working directory. All paths below are relative to this root.

---

## File Structure

```
semana-lista/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── package.json
├── .env.local              ← gitignored, real values
├── .env.example            ← committed, empty values
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx             ← router + auth guard + dark mode toggle
│   ├── index.css           ← Tailwind directives + Inter font import
│   ├── types/
│   │   └── index.ts        ← shared TypeScript interfaces
│   ├── lib/
│   │   ├── supabase.ts     ← createClient() singleton
│   │   └── storage.ts      ← localStorage helpers with prefix
│   ├── hooks/
│   │   ├── useAuth.tsx     ← onAuthStateChange listener
│   │   └── usePerfil.ts    ← fetch/save perfil from DB
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Skeleton.tsx
│   │   │   ├── TagInput.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── RecetaCard.tsx  ← swipeable card with 3 options
│   │   ├── CeldaMenu.tsx   ← one day×meal cell (skeleton → card)
│   │   └── IngredienteRow.tsx
│   └── pages/
│       ├── Auth.tsx
│       ├── Onboarding.tsx
│       ├── Menu.tsx
│       ├── Lista.tsx
│       ├── Exportar.tsx
│       └── MenuPublico.tsx ← read-only public view
└── supabase/
    ├── migrations/
    │   └── 001_schema.sql
    └── functions/
        ├── generar-recetas/
        │   └── index.ts
        └── precios-mercadona/
            └── index.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `semana-lista/package.json`
- Create: `semana-lista/vite.config.ts`
- Create: `semana-lista/tailwind.config.ts`
- Create: `semana-lista/postcss.config.js`
- Create: `semana-lista/tsconfig.json`
- Create: `semana-lista/index.html`
- Create: `semana-lista/.env.example`
- Create: `semana-lista/src/main.tsx`
- Create: `semana-lista/src/App.tsx`
- Create: `semana-lista/src/index.css`
- Create: `semana-lista/src/types/index.ts`
- Create: `semana-lista/src/lib/supabase.ts`
- Create: `semana-lista/src/lib/storage.ts`
- Create: `semana-lista/src/hooks/useAuth.tsx`
- Create: `semana-lista/src/pages/Auth.tsx` (stub)
- Create: `semana-lista/src/pages/Onboarding.tsx` (stub)
- Create: `semana-lista/src/pages/Menu.tsx` (stub)
- Create: `semana-lista/src/pages/Lista.tsx` (stub)
- Create: `semana-lista/src/pages/Exportar.tsx` (stub)
- Create: `semana-lista/src/pages/MenuPublico.tsx` (stub)

**Interfaces:**
- Produces: `supabase` client singleton, `guardar/recuperar/borrar` storage helpers, `useAuth()` hook, `DIAS`, `FRANJAS` constants

- [ ] **Step 1: Scaffold with npm**

```bash
cd "C:\CLAUDE SKIL"
npm create vite@latest semana-lista -- --template react-ts
cd semana-lista
npm install @supabase/supabase-js react-router-dom jspdf html2canvas
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Expected: `node_modules/` created, `tailwind.config.js` generated.

- [ ] **Step 2: Write `package.json` (add missing deps)**

The scaffold already creates it; just verify these are present. If not, install:
```bash
npm install @supabase/supabase-js react-router-dom jspdf html2canvas
```

- [ ] **Step 3: Write `tailwind.config.ts`**

Replace the generated `tailwind.config.js` with:

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'warm-white': '#FAFAF8',
        'green-select': '#4CAF50',
        'orange-accent': '#FF7043',
      },
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: Write `src/index.css`**

```css
/* src/index.css */
@import url('https://rsms.me/inter/inter.css');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-feature-settings: 'cv11', 'ss01';
    font-variation-settings: 'opsz' 32;
  }
  body {
    @apply bg-warm-white text-gray-900 dark:bg-gray-950 dark:text-gray-100;
  }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.skeleton-pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes fade-slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fade-slide-up {
  animation: fade-slide-up 0.3s ease-out;
}
```

- [ ] **Step 5: Write `src/types/index.ts`**

```ts
// src/types/index.ts
export type Objetivo =
  | 'sin_restriccion'
  | 'bajar_peso'
  | 'mas_proteina'
  | 'vegetariano'
  | 'vegano'
  | 'sin_gluten'

export type Unidad = 'g' | 'kg' | 'ml' | 'l' | 'ud' | 'cucharada' | 'pizca'
export type Dificultad = 'fácil' | 'media' | 'difícil'
export type Franja = 'comida' | 'cena'
export type Dia =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo'

export interface Ingrediente {
  nombre: string
  cantidad: number
  unidad: Unidad
}

export interface Receta {
  nombre: string
  tiempo_prep: number
  dificultad: Dificultad
  descripcion_corta: string
  calorias_aprox: number
  ingredientes: Ingrediente[]
  pasos: string[]
  tags: string[]
}

export interface OpcionesSlot {
  dia: Dia
  franja: Franja
  opciones: Receta[]
  error?: boolean
}

export interface Perfil {
  id?: string
  usuario_id?: string
  personas: number
  presupuesto: number
  codigo_postal: string
  supermercado: string
  objetivo: Objetivo
  ingredientes_si: string[]
  ingredientes_no: string[]
  nevera: string[]
}

export type ClaveMenu = `${Dia}_${Franja}`

export type MenuSemanal = Partial<Record<ClaveMenu, Receta>>

export interface ResultadoPrecio {
  ingrediente: string
  cantidad_necesaria: number
  unidad: string
  producto_mercadona?: string
  precio_envase?: number
  tamaño_envase?: number
  unidad_envase?: string
  envases_a_comprar?: number
  coste_real?: number
  sobrante?: number
  sin_precio: boolean
}

export const DIAS: Dia[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
]
export const DIAS_LABEL: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}
export const FRANJAS: Franja[] = ['comida', 'cena']
```

- [ ] **Step 6: Write `src/lib/supabase.ts`**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)
```

- [ ] **Step 7: Write `src/lib/storage.ts`**

```ts
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
```

- [ ] **Step 8: Write `src/hooks/useAuth.tsx`**

```tsx
// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtx {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthCtx>({ user: null, session: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 9: Write stub pages**

```tsx
// src/pages/Auth.tsx
export default function Auth() { return <div>Auth</div> }

// src/pages/Onboarding.tsx
export default function Onboarding() { return <div>Onboarding</div> }

// src/pages/Menu.tsx
export default function Menu() { return <div>Menu</div> }

// src/pages/Lista.tsx
export default function Lista() { return <div>Lista</div> }

// src/pages/Exportar.tsx
export default function Exportar() { return <div>Exportar</div> }

// src/pages/MenuPublico.tsx
export default function MenuPublico() { return <div>Menú Público</div> }
```

- [ ] **Step 10: Write `src/hooks/usePerfil.ts`**

```ts
// src/hooks/usePerfil.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types'
import { useAuth } from './useAuth'

export function usePerfil() {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('perfiles')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPerfil(data as Perfil | null)
        setLoading(false)
      })
  }, [user])

  async function guardarPerfil(p: Omit<Perfil, 'id' | 'usuario_id'>) {
    if (!user) return
    const { data } = await supabase
      .from('perfiles')
      .upsert({ ...p, usuario_id: user.id }, { onConflict: 'usuario_id' })
      .select()
      .single()
    setPerfil(data as Perfil)
  }

  return { perfil, loading, guardarPerfil }
}
```

- [ ] **Step 11: Write `src/App.tsx`**

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Menu from './pages/Menu'
import Lista from './pages/Lista'
import Exportar from './pages/Exportar'
import MenuPublico from './pages/MenuPublico'

function DarkToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )
  function toggle() {
    document.documentElement.classList.toggle('dark')
    setDark(d => !d)
  }
  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 rounded-full bg-gray-200 dark:bg-gray-700 px-3 py-1 text-sm"
      aria-label="Toggle dark mode"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <>
      <DarkToggle />
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route path="/menu" element={<Protected><Menu /></Protected>} />
        <Route path="/lista" element={<Protected><Lista /></Protected>} />
        <Route path="/exportar" element={<Protected><Exportar /></Protected>} />
        <Route path="/menu/:semanaId" element={<MenuPublico />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 12: Write `src/main.tsx`**

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 13: Write `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Semana Lista</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 14: Write `.env.example`**

```
# Copy to .env.local and fill in values
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 15: Verify dev server starts**

```bash
npm run dev
```

Expected: `Local: http://localhost:5173/` with no compile errors. Visit the URL and see "Auth" text.

- [ ] **Step 16: Commit**

```bash
git init
git add .
git commit -m "feat: project scaffold — Vite+React+TS+Tailwind+Supabase"
```

---

### Task 2: Database Schema & RLS

**Files:**
- Create: `supabase/migrations/001_schema.sql`

**Interfaces:**
- Produces: all 6 tables with RLS policies; downstream tasks can query `usuarios`, `perfiles`, `semanas`, `historial_recetas`, `catalogo_cache`, `mapa_ingredientes`.

- [ ] **Step 1: Write `supabase/migrations/001_schema.sql`**

```sql
-- supabase/migrations/001_schema.sql

-- ─── User profile (created by trigger on auth.users insert) ───────────────────
create table if not exists public.usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios(id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Perfil ───────────────────────────────────────────────────────────────────
create table if not exists public.perfiles (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid unique references public.usuarios(id) on delete cascade,
  personas         int not null default 2,
  presupuesto      numeric not null default 100,
  codigo_postal    text not null default '28001',
  supermercado     text not null default 'mercadona',
  objetivo         text not null default 'sin_restriccion',
  ingredientes_si  text[] not null default '{}',
  ingredientes_no  text[] not null default '{}',
  nevera           text[] not null default '{}'
);

-- ─── Semanas ──────────────────────────────────────────────────────────────────
create table if not exists public.semanas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid references public.usuarios(id) on delete cascade,
  fecha_inicio     date not null,
  recetas_elegidas jsonb not null default '{}',
  lista_compra     jsonb not null default '[]',
  total_precio     numeric,
  es_publica       boolean not null default false
);

-- ─── Historial recetas ────────────────────────────────────────────────────────
create table if not exists public.historial_recetas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid references public.usuarios(id) on delete cascade,
  nombre_receta text not null,
  fecha_uso     date not null default current_date
);

-- ─── Catálogo Mercadona (cache compartido, sin RLS) ───────────────────────────
create table if not exists public.catalogo_cache (
  id            uuid primary key default gen_random_uuid(),
  termino       text unique not null,
  payload       jsonb not null,
  actualizado_en timestamptz not null default now()
);

-- ─── Mapa de ingredientes conocidos (cache compartido) ────────────────────────
create table if not exists public.mapa_ingredientes (
  id                     uuid primary key default gen_random_uuid(),
  ingrediente_normalizado text unique not null,
  mercadona_product_id   text,
  confirmado             boolean not null default false
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.usuarios          enable row level security;
alter table public.perfiles          enable row level security;
alter table public.semanas           enable row level security;
alter table public.historial_recetas enable row level security;
alter table public.catalogo_cache    enable row level security;
alter table public.mapa_ingredientes enable row level security;

-- usuarios: solo puede leer/escribir su propia fila
create policy "usuarios_own" on public.usuarios
  using (auth.uid() = id) with check (auth.uid() = id);

-- perfiles: solo su propio perfil
create policy "perfiles_own" on public.perfiles
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- semanas: propio + lectura pública de las marcadas es_publica
create policy "semanas_own" on public.semanas
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "semanas_public_read" on public.semanas
  for select using (es_publica = true);

-- historial: solo propio
create policy "historial_own" on public.historial_recetas
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- catalogo_cache: lectura pública; escritura solo service_role (Edge Functions)
create policy "catalogo_read_all" on public.catalogo_cache
  for select using (true);

-- mapa_ingredientes: lectura pública; escritura solo service_role
create policy "mapa_read_all" on public.mapa_ingredientes
  for select using (true);

-- Index para búsquedas frecuentes
create index if not exists historial_usuario_fecha
  on public.historial_recetas(usuario_id, fecha_uso desc);
create index if not exists catalogo_termino
  on public.catalogo_cache(termino);
```

- [ ] **Step 2: Apply migration to Supabase**

In Supabase Dashboard → SQL Editor, paste and run the entire SQL above.

Or with the CLI:
```bash
supabase db push
```

Expected: all 6 tables visible in Table Editor. RLS enabled on all tables.

- [ ] **Step 3: Verify trigger**

In SQL Editor:
```sql
select count(*) from public.usuarios;
```

Sign up once through the app and run again — should show 1 row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat: DB schema with 6 tables and RLS policies"
```

---

### Task 3: Auth Page

**Files:**
- Modify: `src/pages/Auth.tsx` (replace stub)

**Interfaces:**
- Consumes: `supabase` client, `useAuth()`, react-router `useNavigate`
- Produces: logged-in session; redirects new users to `/onboarding`, returning users to `/menu`

- [ ] **Step 1: Write `src/pages/Auth.tsx`**

```tsx
// src/pages/Auth.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Mode = 'login' | 'registro'

export default function Auth() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!loading && user) redirectAfterLogin()
  }, [user, loading])

  async function redirectAfterLogin() {
    const { data } = await supabase
      .from('perfiles')
      .select('id')
      .eq('usuario_id', user!.id)
      .maybeSingle()
    navigate(data ? '/menu' : '/onboarding', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (mode === 'registro') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setEnviando(false)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/menu` },
    })
  }

  if (loading) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-2 text-center">🥗 Semana Lista</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Tu planificador semanal con IA
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border rounded-card px-4 py-2 bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-select"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border rounded-card px-4 py-2 bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-select"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-green-select text-white rounded-card py-2 font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            {enviando ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        <button
          onClick={handleGoogle}
          className="mt-4 w-full border rounded-card py-2 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continuar con Google
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? '¿Sin cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'registro' : 'login')}
            className="text-green-select font-medium hover:underline"
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test auth manually**

```bash
npm run dev
```

1. Visit `http://localhost:5173/`
2. Register with test email — redirects to `/onboarding` (stub).
3. Log out (in browser console: `supabase.auth.signOut()`), log back in — redirects to `/onboarding` (no profile yet, correct).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "feat: auth page with email/password and Google OAuth"
```

---

### Task 4: Shared UI Components

**Files:**
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/TagInput.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/ProgressBar.tsx`

**Interfaces:**
- Produces: `<Skeleton>`, `<TagInput tags value onChange>`, `<Badge variant>`, `<ProgressBar value max>`
- Consumed by: Onboarding, Menu, Lista pages

- [ ] **Step 1: Write `src/components/ui/Skeleton.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `src/components/ui/TagInput.tsx`**

```tsx
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
    const val = input.trim().toLowerCase()
    if (val && !tags.includes(val)) {
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
          className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full px-2.5 py-0.5 text-sm"
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
```

- [ ] **Step 3: Write `src/components/ui/Badge.tsx`**

```tsx
// src/components/ui/Badge.tsx
import type { Dificultad } from '../../types'

const DIFICULTAD_STYLES: Record<Dificultad, string> = {
  'fácil':   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'media':   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'difícil': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

interface Props {
  dificultad: Dificultad
}

export function Badge({ dificultad }: Props) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DIFICULTAD_STYLES[dificultad]}`}>
      {dificultad}
    </span>
  )
}
```

- [ ] **Step 4: Write `src/components/ui/ProgressBar.tsx`**

```tsx
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
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: shared UI components (Skeleton, TagInput, Badge, ProgressBar)"
```

---

### Task 5: Onboarding Wizard

**Files:**
- Modify: `src/pages/Onboarding.tsx` (replace stub)

**Interfaces:**
- Consumes: `usePerfil().guardarPerfil()`, `TagInput`, `guardar/recuperar` storage helpers
- Produces: completed `perfiles` row in DB; navigates to `/menu`

- [ ] **Step 1: Write `src/pages/Onboarding.tsx`**

```tsx
// src/pages/Onboarding.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TagInput } from '../components/ui/TagInput'
import { ProgressBar } from '../components/ui/ProgressBar'
import { usePerfil } from '../hooks/usePerfil'
import { guardar, recuperar } from '../lib/storage'
import type { Objetivo, Perfil } from '../types'

const OBJETIVOS: { value: Objetivo; label: string; emoji: string }[] = [
  { value: 'sin_restriccion', label: 'Sin restricciones', emoji: '🍽️' },
  { value: 'bajar_peso',      label: 'Bajar peso',        emoji: '⚖️' },
  { value: 'mas_proteina',    label: 'Más proteína',      emoji: '💪' },
  { value: 'vegetariano',     label: 'Vegetariano',       emoji: '🥦' },
  { value: 'vegano',          label: 'Vegano',            emoji: '🌱' },
  { value: 'sin_gluten',      label: 'Sin gluten',        emoji: '🌾' },
]

const TOTAL_PASOS = 7

type Draft = Omit<Perfil, 'id' | 'usuario_id'>

const DRAFT_INICIAL: Draft = {
  personas: 2,
  presupuesto: 100,
  codigo_postal: '',
  supermercado: 'mercadona',
  objetivo: 'sin_restriccion',
  ingredientes_si: [],
  ingredientes_no: [],
  nevera: [],
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { guardarPerfil } = usePerfil()
  const [paso, setPaso] = useState(() => recuperar<number>('onboarding_paso') ?? 1)
  const [draft, setDraft] = useState<Draft>(
    () => recuperar<Draft>('onboarding_draft') ?? DRAFT_INICIAL
  )
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    guardar('onboarding_paso', paso)
    guardar('onboarding_draft', draft)
  }, [paso, draft])

  function set<K extends keyof Draft>(key: K, val: Draft[K]) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  async function finalizar() {
    setGuardando(true)
    await guardarPerfil(draft)
    navigate('/menu', { replace: true })
  }

  const pasoLabel = [
    'Personas en el hogar',
    'Presupuesto semanal',
    'Código postal',
    'Objetivo nutricional',
    'Ingredientes favoritos',
    'Ingredientes a evitar',
    '¿Qué tienes en la nevera?',
  ][paso - 1]

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold mb-4">Cuéntanos sobre ti</h1>
        <ProgressBar value={paso} max={TOTAL_PASOS} label={pasoLabel} />
      </div>

      <div className="flex-1">
        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">¿Cuántas personas van a comer?</p>
            <div className="flex gap-3 flex-wrap">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => set('personas', n)}
                  className={`w-14 h-14 rounded-card text-xl font-bold border-2 transition-colors ${
                    draft.personas === n
                      ? 'border-green-select bg-green-50 dark:bg-green-900 text-green-select'
                      : 'border-gray-200 dark:border-gray-700 hover:border-green-select'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">Presupuesto semanal para la compra (€)</p>
            <input
              type="number"
              min={20}
              max={500}
              value={draft.presupuesto}
              onChange={e => set('presupuesto', Number(e.target.value))}
              className="w-full border-2 rounded-card px-4 py-3 text-2xl font-bold text-center bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
            />
            <p className="text-sm text-gray-400">Recomendado: 80–120 € para 2 personas</p>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">Código postal para precios de tu Mercadona más cercano</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={draft.codigo_postal}
              onChange={e => set('codigo_postal', e.target.value)}
              placeholder="28001"
              className="w-full border-2 rounded-card px-4 py-3 text-2xl font-bold text-center bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
            />
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">¿Tienes algún objetivo nutricional?</p>
            {OBJETIVOS.map(obj => (
              <button
                key={obj.value}
                onClick={() => set('objetivo', obj.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-card border-2 text-left transition-colors ${
                  draft.objetivo === obj.value
                    ? 'border-green-select bg-green-50 dark:bg-green-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-select'
                }`}
              >
                <span className="text-2xl">{obj.emoji}</span>
                <span className="font-medium">{obj.label}</span>
              </button>
            ))}
          </div>
        )}

        {paso === 5 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">Ingredientes que te gustan o usas frecuentemente</p>
            <TagInput
              tags={draft.ingredientes_si}
              onChange={tags => set('ingredientes_si', tags)}
              placeholder="p.ej. pollo, lentejas, tomate..."
            />
          </div>
        )}

        {paso === 6 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">Ingredientes que NO quieres en tus menús</p>
            <TagInput
              tags={draft.ingredientes_no}
              onChange={tags => set('ingredientes_no', tags)}
              placeholder="p.ej. marisco, cilantro..."
            />
          </div>
        )}

        {paso === 7 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              ¿Qué tienes en la nevera esta semana? (lo usaremos en los menús)
            </p>
            <TagInput
              tags={draft.nevera}
              onChange={tags => set('nevera', tags)}
              placeholder="p.ej. huevos, queso, yogur... (opcional)"
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {paso > 1 && (
          <button
            onClick={() => setPaso(p => p - 1)}
            className="flex-1 border-2 border-gray-300 dark:border-gray-600 rounded-card py-3 font-medium hover:border-green-select"
          >
            Atrás
          </button>
        )}
        {paso < TOTAL_PASOS ? (
          <button
            onClick={() => setPaso(p => p + 1)}
            disabled={paso === 3 && draft.codigo_postal.length !== 5}
            className="flex-1 bg-green-select text-white rounded-card py-3 font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            Siguiente
          </button>
        ) : (
          <button
            onClick={finalizar}
            disabled={guardando}
            className="flex-1 bg-orange-accent text-white rounded-card py-3 font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : '¡Empezar! 🚀'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test onboarding manually**

Start dev server, register a new user, step through all 7 wizard steps, click "¡Empezar!" — should navigate to `/menu` (stub). Verify `perfiles` row exists in Supabase.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Onboarding.tsx
git commit -m "feat: 7-step onboarding wizard with localStorage persistence"
```

---

### Task 6: Edge Function — generar-recetas

**Files:**
- Create: `supabase/functions/generar-recetas/index.ts`

**Interfaces:**
- Input: `POST { dia, franja, perfil, recetas_ya_usadas }`
- Output success: `{ dia, franja, opciones: Receta[] }`
- Output error: `{ error: true, dia, franja, mensaje: string }`

- [ ] **Step 1: Write `supabase/functions/generar-recetas/index.ts`**

```ts
// supabase/functions/generar-recetas/index.ts
import Anthropic from 'npm:@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RECETA_SCHEMA = {
  type: 'object',
  properties: {
    opciones: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          nombre:           { type: 'string' },
          tiempo_prep:      { type: 'number' },
          dificultad:       { type: 'string', enum: ['fácil', 'media', 'difícil'] },
          descripcion_corta:{ type: 'string' },
          calorias_aprox:   { type: 'number' },
          ingredientes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre:   { type: 'string' },
                cantidad: { type: 'number' },
                unidad:   { type: 'string', enum: ['g', 'kg', 'ml', 'l', 'ud', 'cucharada', 'pizca'] },
              },
              required: ['nombre', 'cantidad', 'unidad'],
              additionalProperties: false,
            },
          },
          pasos: { type: 'array', items: { type: 'string' } },
          tags:  { type: 'array', items: { type: 'string' } },
        },
        required: ['nombre', 'tiempo_prep', 'dificultad', 'descripcion_corta', 'calorias_aprox', 'ingredientes', 'pasos', 'tags'],
        additionalProperties: false,
      },
    },
  },
  required: ['opciones'],
  additionalProperties: false,
}

const FRANJA_LABEL: Record<string, string> = {
  comida: 'comida (mediodía)',
  cena: 'cena (noche)',
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
  jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo',
}

function construirPrompt(
  dia: string,
  franja: string,
  perfil: Record<string, unknown>,
  recetasYaUsadas: string[],
): string {
  const { personas, objetivo, ingredientes_no, ingredientes_si, nevera } = perfil as {
    personas: number
    objetivo: string
    ingredientes_no: string[]
    ingredientes_si: string[]
    nevera: string[]
  }

  let prompt = `Genera exactamente 3 recetas para la ${FRANJA_LABEL[franja] ?? franja} del ${DIA_LABEL[dia] ?? dia}.

Hogar: ${personas} persona${personas > 1 ? 's' : ''}.
Objetivo nutricional: ${objetivo}.`

  if (ingredientes_no?.length) {
    prompt += `\nIngredientes PROHIBIDOS (nunca incluir): ${ingredientes_no.join(', ')}.`
  }
  if (ingredientes_si?.length) {
    prompt += `\nIngredientes preferidos (incluir si encaja): ${ingredientes_si.join(', ')}.`
  }
  if (nevera?.length) {
    prompt += `\nYa tiene en casa esta semana (priorizar su uso): ${nevera.join(', ')}.`
  }
  if (recetasYaUsadas?.length) {
    prompt += `\nRecetas ya planificadas esta semana (NO repetir ni variantes similares): ${recetasYaUsadas.join(', ')}.`
  }

  prompt += '\n\nLas 3 opciones deben ser completamente distintas entre sí. Las cantidades de ingredientes deben ser para el número de personas indicado.'

  return prompt
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  let dia = '', franja = ''
  try {
    const body = await req.json()
    dia = body.dia
    franja = body.franja
    const { perfil, recetas_ya_usadas = [] } = body

    const prompt = construirPrompt(dia, franja, perfil, recetas_ya_usadas)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: RECETA_SCHEMA,
        },
      },
    } as Parameters<typeof anthropic.messages.create>[0])

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const datos = JSON.parse(text)

    return new Response(
      JSON.stringify({ dia, franja, opciones: datos.opciones }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : 'Error interno'
    return new Response(
      JSON.stringify({ error: true, dia, franja, mensaje }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
```

- [ ] **Step 2: Set secret in Supabase**

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Or via Dashboard → Settings → Edge Functions → Secrets.

- [ ] **Step 3: Deploy function**

```bash
supabase functions deploy generar-recetas --no-verify-jwt
```

Expected: `Deployed generar-recetas`

- [ ] **Step 4: Smoke-test via curl**

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/generar-recetas \
  -H "Content-Type: application/json" \
  -d '{
    "dia": "lunes",
    "franja": "comida",
    "perfil": {
      "personas": 2,
      "objetivo": "sin_restriccion",
      "ingredientes_si": [],
      "ingredientes_no": [],
      "nevera": []
    },
    "recetas_ya_usadas": []
  }'
```

Expected: JSON with `{ dia: "lunes", franja: "comida", opciones: [{...}, {...}, {...}] }`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generar-recetas/
git commit -m "feat: edge function generar-recetas with Claude structured outputs"
```

---

### Task 7: Menu Planner Components

**Files:**
- Create: `src/components/RecetaCard.tsx`
- Create: `src/components/CeldaMenu.tsx`

**Interfaces:**
- `RecetaCard`: props `{ opciones: Receta[], seleccionada: number, onSeleccionar: (i: number) => void }`
- `CeldaMenu`: props `{ dia: Dia, franja: Franja, estado: 'idle' | 'cargando' | 'listo' | 'error', datos?: OpcionesSlot, onReintentar: () => void, seleccionada?: number, onSeleccionar: (i: number) => void }`
- Consumed by: `Menu.tsx`

- [ ] **Step 1: Write `src/components/RecetaCard.tsx`**

```tsx
// src/components/RecetaCard.tsx
import { useState } from 'react'
import { Badge } from './ui/Badge'
import type { Receta } from '../types'

interface Props {
  opciones: Receta[]
  seleccionada: number
  onSeleccionar: (i: number) => void
}

const DIFICULTAD_EMOJI: Record<string, string> = {
  'fácil': '🟢', 'media': '🟡', 'difícil': '🔴',
}

function tagEmoji(tags: string[]): string {
  if (tags.includes('pasta')) return '🍝'
  if (tags.includes('arroz')) return '🍚'
  if (tags.includes('ensalada')) return '🥗'
  if (tags.includes('sopa')) return '🍲'
  if (tags.includes('carne')) return '🥩'
  if (tags.includes('pescado')) return '🐟'
  if (tags.includes('legumbres')) return '🫘'
  if (tags.includes('huevo')) return '🥚'
  if (tags.includes('pollo')) return '🍗'
  return '🍽️'
}

export function RecetaCard({ opciones, seleccionada, onSeleccionar }: Props) {
  const [vista, setVista] = useState(seleccionada)
  const receta = opciones[vista]

  function cambiar(delta: number) {
    const next = (vista + delta + opciones.length) % opciones.length
    setVista(next)
  }

  return (
    <div
      className={`rounded-card border-2 transition-colors cursor-pointer fade-slide-up ${
        vista === seleccionada
          ? 'border-green-select bg-green-50 dark:bg-green-950'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      }`}
      onClick={() => onSeleccionar(vista)}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-semibold text-sm leading-tight">
            {tagEmoji(receta.tags)} {receta.nombre}
          </span>
          {vista === seleccionada && (
            <span className="shrink-0 text-green-select text-lg">✓</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
          {receta.descripcion_corta}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge dificultad={receta.dificultad} />
          <span className="text-xs text-gray-400">⏱ {receta.tiempo_prep} min</span>
          <span className="text-xs text-gray-400">🔥 {receta.calorias_aprox} kcal</span>
        </div>
      </div>

      {opciones.length > 1 && (
        <div className="border-t border-gray-100 dark:border-gray-800 flex">
          {opciones.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setVista(i); onSeleccionar(i) }}
              className={`flex-1 py-1.5 text-xs transition-colors ${
                i === vista
                  ? 'bg-green-select text-white'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              } ${i === 0 ? 'rounded-bl-card' : ''} ${i === opciones.length - 1 ? 'rounded-br-card' : ''}`}
            >
              Opción {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/CeldaMenu.tsx`**

```tsx
// src/components/CeldaMenu.tsx
import { Skeleton } from './ui/Skeleton'
import { RecetaCard } from './RecetaCard'
import type { Dia, Franja, OpcionesSlot } from '../types'

interface Props {
  dia: Dia
  franja: Franja
  estado: 'idle' | 'cargando' | 'listo' | 'error'
  datos?: OpcionesSlot
  onReintentar: () => void
  seleccionada: number
  onSeleccionar: (i: number) => void
}

export function CeldaMenu({ dia, franja, estado, datos, onReintentar, seleccionada, onSeleccionar }: Props) {
  if (estado === 'idle') {
    return (
      <div className="rounded-card border-2 border-dashed border-gray-200 dark:border-gray-700 p-3 text-center text-sm text-gray-400 min-h-[80px] flex items-center justify-center">
        Pulsa "Generar mi semana"
      </div>
    )
  }

  if (estado === 'cargando') {
    return (
      <div className="rounded-card border border-gray-200 dark:border-gray-700 p-3 min-h-[80px]">
        <p className="text-xs text-gray-400 mb-2 skeleton-pulse">🍳 Cocinando...</p>
        <Skeleton lines={3} />
      </div>
    )
  }

  if (estado === 'error' || !datos) {
    return (
      <div className="rounded-card border-2 border-red-200 dark:border-red-900 p-3 min-h-[80px] flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-red-500">Error al generar</p>
        <button
          onClick={onReintentar}
          className="text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-3 py-1 hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <RecetaCard
      opciones={datos.opciones}
      seleccionada={seleccionada}
      onSeleccionar={onSeleccionar}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RecetaCard.tsx src/components/CeldaMenu.tsx
git commit -m "feat: RecetaCard and CeldaMenu components"
```

---

### Task 8: Menu Planner Screen

**Files:**
- Modify: `src/pages/Menu.tsx` (replace stub)

**Interfaces:**
- Consumes: `usePerfil()`, `CeldaMenu`, `ProgressBar`, `generar-recetas` Edge Function (14 parallel fetches), `guardar/recuperar` storage
- Produces: `MenuSemanal` saved to localStorage under key `menu_semana`; navigates to `/lista` when all selected

- [ ] **Step 1: Write `src/pages/Menu.tsx`**

```tsx
// src/pages/Menu.tsx
import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CeldaMenu } from '../components/CeldaMenu'
import { ProgressBar } from '../components/ui/ProgressBar'
import { usePerfil } from '../hooks/usePerfil'
import { guardar, recuperar } from '../lib/storage'
import type { Dia, Franja, OpcionesSlot, MenuSemanal, ClaveMenu } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

type EstadoCelda = 'idle' | 'cargando' | 'listo' | 'error'

interface EstadoSlot {
  estado: EstadoCelda
  datos?: OpcionesSlot
}

type MapaEstados = Partial<Record<ClaveMenu, EstadoSlot>>
type MapaSeleccion = Partial<Record<ClaveMenu, number>>

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generar-recetas`

async function fetchSlot(
  dia: Dia,
  franja: Franja,
  perfil: object,
  recetasYaUsadas: string[],
): Promise<OpcionesSlot> {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dia, franja, perfil, recetas_ya_usadas: recetasYaUsadas }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.mensaje)
  return data as OpcionesSlot
}

export default function Menu() {
  const navigate = useNavigate()
  const { perfil, loading: perfilLoading } = usePerfil()

  const [estados, setEstados] = useState<MapaEstados>(() =>
    recuperar<MapaEstados>('menu_estados') ?? {}
  )
  const [seleccion, setSeleccion] = useState<MapaSeleccion>(() =>
    recuperar<MapaSeleccion>('menu_seleccion') ?? {}
  )
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    guardar('menu_estados', estados)
  }, [estados])

  useEffect(() => {
    guardar('menu_seleccion', seleccion)
  }, [seleccion])

  function setSlotEstado(clave: ClaveMenu, slot: EstadoSlot) {
    setEstados(prev => ({ ...prev, [clave]: slot }))
  }

  async function generarSlot(dia: Dia, franja: Franja, recetasYaUsadas: string[]) {
    if (!perfil) return
    const clave: ClaveMenu = `${dia}_${franja}`
    setSlotEstado(clave, { estado: 'cargando' })
    try {
      const datos = await fetchSlot(dia, franja, perfil, recetasYaUsadas)
      setSlotEstado(clave, { estado: 'listo', datos })
      setSeleccion(prev => ({ ...prev, [clave]: 0 }))
    } catch {
      setSlotEstado(clave, { estado: 'error' })
    }
  }

  async function generarSemana() {
    if (!perfil || generando) return
    setGenerando(true)

    // Fetch historial for "no repetir" prompt
    let recetasYaUsadas: string[] = []
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase
        .from('historial_recetas')
        .select('nombre_receta')
        .order('fecha_uso', { ascending: false })
        .limit(28)
      recetasYaUsadas = (data ?? []).map((r: { nombre_receta: string }) => r.nombre_receta)
    } catch { /* historial is a best-effort enhancement */ }

    // Launch all 14 in parallel — no await here, each updates its own state
    const promises = DIAS.flatMap(dia =>
      FRANJAS.map(franja => generarSlot(dia, franja, recetasYaUsadas))
    )
    await Promise.allSettled(promises)
    setGenerando(false)
  }

  function sorprendeme() {
    setSeleccion(prev => {
      const next = { ...prev }
      for (const dia of DIAS) {
        for (const franja of FRANJAS) {
          const clave: ClaveMenu = `${dia}_${franja}`
          if (!next[clave] && estados[clave]?.datos) {
            next[clave] = Math.floor(Math.random() * 3)
          }
        }
      }
      return next
    })
  }

  const totalSeleccionadas = Object.keys(seleccion).length

  function irALista() {
    // Build MenuSemanal from selections
    const menu: MenuSemanal = {}
    for (const dia of DIAS) {
      for (const franja of FRANJAS) {
        const clave: ClaveMenu = `${dia}_${franja}`
        const idx = seleccion[clave]
        const opciones = estados[clave]?.datos?.opciones
        if (idx !== undefined && opciones) {
          menu[clave] = opciones[idx]
        }
      }
    }
    guardar('menu_semana', menu)
    navigate('/lista')
  }

  if (perfilLoading) return null

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 sticky top-4 bg-warm-white dark:bg-gray-950 py-2 z-10">
        <h1 className="text-xl font-bold">🗓️ Tu semana</h1>
        <div className="flex gap-2">
          <button
            onClick={sorprendeme}
            title="Autoseleccionar opciones aleatorias"
            className="text-sm border rounded-card px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            🎲 Sorpréndeme
          </button>
          <button
            onClick={generarSemana}
            disabled={generando || !perfil}
            className="text-sm bg-green-select text-white rounded-card px-3 py-1.5 font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            {generando ? 'Generando...' : 'Generar mi semana ✨'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar
          value={totalSeleccionadas}
          max={14}
          label="Comidas elegidas"
        />
      </div>

      <div className="space-y-6">
        {DIAS.map(dia => (
          <div key={dia}>
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {DIAS_LABEL[dia]}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {FRANJAS.map(franja => {
                const clave: ClaveMenu = `${dia}_${franja}`
                const slot = estados[clave] ?? { estado: 'idle' as EstadoCelda }
                return (
                  <div key={franja}>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1 capitalize">
                      {franja}
                    </p>
                    <CeldaMenu
                      dia={dia}
                      franja={franja}
                      estado={slot.estado}
                      datos={slot.datos}
                      onReintentar={() => generarSlot(dia, franja, [])}
                      seleccionada={seleccion[clave] ?? 0}
                      onSeleccionar={i =>
                        setSeleccion(prev => ({ ...prev, [clave]: i }))
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {totalSeleccionadas === 14 && (
        <div className="mt-8 sticky bottom-4">
          <button
            onClick={irALista}
            className="w-full bg-orange-accent text-white rounded-card py-4 text-lg font-bold shadow-lg hover:opacity-90"
          >
            Ver lista de la compra →
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Test in browser**

1. Complete onboarding → arrive at `/menu`
2. Click "Generar mi semana" — all 14 cells show skeletons simultaneously
3. Cells populate progressively as Claude responds (~2–5s per call)
4. Click "Opción 2" tab on a card — selection switches
5. Once all 14 selected, "Ver lista de la compra" button appears

- [ ] **Step 3: Commit**

```bash
git add src/pages/Menu.tsx
git commit -m "feat: menu planner with 14 parallel recipe generation calls"
```

---

### Task 9: Edge Function — precios-mercadona

**Files:**
- Create: `supabase/functions/precios-mercadona/index.ts`

**Interfaces:**
- Input: `POST { ingredientes: [{nombre, cantidad, unidad}[]], codigo_postal: string }`
- Output: `{ resultados: ResultadoPrecio[] }`

- [ ] **Step 1: Write `supabase/functions/precios-mercadona/index.ts`**

```ts
// supabase/functions/precios-mercadona/index.ts
import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MERCADONA_BASE = 'https://tienda.mercadona.es/api'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

// ─── Normalization ────────────────────────────────────────────────────────────
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Stable interface — only this function touches Mercadona ─────────────────
interface ProductoMercadona {
  id: string
  nombre: string
  precio: number         // € por envase
  tamaño: number         // cantidad por envase
  unidad: string         // unidad del envase (g, ml, ud...)
  precio_por_unidad: number // € por unidad base
}

async function buscarProducto(
  termino: string,
  codigoPostal: string,
): Promise<ProductoMercadona | null> {
  const terminoNorm = normalizar(termino)

  // Layer 1: known mappings in mapa_ingredientes
  const { data: mapa } = await supabase
    .from('mapa_ingredientes')
    .select('mercadona_product_id')
    .eq('ingrediente_normalizado', terminoNorm)
    .maybeSingle()

  if (mapa?.mercadona_product_id) {
    const prod = await fetchProductById(mapa.mercadona_product_id, codigoPostal)
    if (prod) return prod
  }

  // Layer 2: catalog cache
  const { data: cache } = await supabase
    .from('catalogo_cache')
    .select('payload, actualizado_en')
    .eq('termino', terminoNorm)
    .maybeSingle()

  if (cache) {
    const age = Date.now() - new Date(cache.actualizado_en).getTime()
    if (age < CACHE_TTL_MS) {
      return cache.payload as ProductoMercadona | null
    }
  }

  // Layer 3: live Mercadona API
  const resultado = await buscarEnMercadona(terminoNorm, codigoPostal)

  // Cache the result (even null means "not found")
  await supabase
    .from('catalogo_cache')
    .upsert(
      { termino: terminoNorm, payload: resultado, actualizado_en: new Date().toISOString() },
      { onConflict: 'termino' },
    )

  return resultado
}

async function fetchProductById(
  id: string,
  codigoPostal: string,
): Promise<ProductoMercadona | null> {
  try {
    await fijarAlmacen(codigoPostal)
    const res = await fetch(`${MERCADONA_BASE}/products/${id}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return parsearProducto(data)
  } catch {
    return null
  }
}

async function fijarAlmacen(codigoPostal: string): Promise<void> {
  try {
    await fetch(`${MERCADONA_BASE}/postal-codes/actions/change-pc/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({ new_postal_code: codigoPostal }),
    })
  } catch { /* non-critical — proceed with default warehouse */ }
}

async function buscarEnMercadona(
  terminoNorm: string,
  codigoPostal: string,
): Promise<ProductoMercadona | null> {
  try {
    await fijarAlmacen(codigoPostal)

    // Fetch all categories
    const catRes = await fetch(`${MERCADONA_BASE}/categories/`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
    })
    if (!catRes.ok) return null
    const catData = await catRes.json()

    const categorias: { id: number }[] = catData.results ?? []
    const palabras = terminoNorm.split(' ')

    let mejorMatch: ProductoMercadona | null = null
    let mejorPuntuacion = 0

    // Search through categories looking for matching products
    for (const cat of categorias) {
      const subRes = await fetch(`${MERCADONA_BASE}/categories/${cat.id}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
      })
      if (!subRes.ok) continue
      const subData = await subRes.json()

      const subcategorias = subData.categories ?? []
      for (const sub of subcategorias) {
        const productos = sub.products ?? []
        for (const prod of productos) {
          const nombreNorm = normalizar(prod.display_name ?? '')
          const palabrasMatch = palabras.filter((p: string) => nombreNorm.includes(p)).length
          const puntuacion = palabrasMatch / palabras.length

          if (puntuacion > mejorPuntuacion) {
            mejorPuntuacion = puntuacion
            mejorMatch = parsearProducto(prod)
          }
        }
      }

      if (mejorPuntuacion >= 0.8) break // good enough match, stop searching
    }

    return mejorPuntuacion >= 0.5 ? mejorMatch : null
  } catch {
    return null
  }
}

function parsearProducto(raw: Record<string, unknown>): ProductoMercadona | null {
  try {
    const pi = raw.price_instructions as Record<string, unknown> | undefined
    if (!pi) return null

    const precio = Number(pi.unit_price ?? pi.bulk_price ?? 0)
    const skuQty = Number(pi.sku_quantity ?? 1)
    const approxSize = skuQty > 0 ? skuQty : 1

    // Try to detect unit from product name or reference_format
    const refFormat = String(raw.format ?? raw.reference_format ?? '')
    const unidadMatch = refFormat.match(/(\d+)\s*(g|kg|ml|l|ud)/i)
    const tamaño = unidadMatch ? Number(unidadMatch[1]) : approxSize
    const unidad = unidadMatch ? unidadMatch[2].toLowerCase() : 'ud'

    const precioPorUnidad = tamaño > 0 ? precio / tamaño : precio

    return {
      id: String(raw.id ?? ''),
      nombre: String(raw.display_name ?? ''),
      precio,
      tamaño,
      unidad,
      precio_por_unidad: precioPorUnidad,
    }
  } catch {
    return null
  }
}

// ─── Unit conversion helpers ──────────────────────────────────────────────────
// Convert ingredient quantity to same unit as the product for packaging math
function convertir(cantidad: number, unidadIngrediente: string, unidadProducto: string): number {
  // Normalize both units
  const uIng = unidadIngrediente.toLowerCase()
  const uProd = unidadProducto.toLowerCase()

  if (uIng === uProd) return cantidad

  // g ↔ kg
  if (uIng === 'g' && uProd === 'kg') return cantidad / 1000
  if (uIng === 'kg' && uProd === 'g') return cantidad * 1000

  // ml ↔ l
  if (uIng === 'ml' && uProd === 'l') return cantidad / 1000
  if (uIng === 'l' && uProd === 'ml') return cantidad * 1000

  // Fallback: assume 1:1
  return cantidad
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  try {
    const { ingredientes, codigo_postal = '28001' } = await req.json() as {
      ingredientes: Array<{ nombre: string; cantidad: number; unidad: string }>
      codigo_postal: string
    }

    const resultados = await Promise.all(
      ingredientes.map(async (ing) => {
        const producto = await buscarProducto(ing.nombre, codigo_postal)

        if (!producto) {
          return {
            ingrediente: ing.nombre,
            cantidad_necesaria: ing.cantidad,
            unidad: ing.unidad,
            sin_precio: true,
          }
        }

        const cantConvertida = convertir(ing.cantidad, ing.unidad, producto.unidad)
        const envases = Math.ceil(cantConvertida / producto.tamaño)
        const costeReal = envases * producto.precio
        const sobrante = envases * producto.tamaño - cantConvertida

        return {
          ingrediente: ing.nombre,
          cantidad_necesaria: ing.cantidad,
          unidad: ing.unidad,
          producto_mercadona: producto.nombre,
          precio_envase: producto.precio,
          tamaño_envase: producto.tamaño,
          unidad_envase: producto.unidad,
          envases_a_comprar: envases,
          coste_real: Math.round(costeReal * 100) / 100,
          sobrante: Math.round(sobrante * 10) / 10,
          sin_precio: false,
        }
      })
    )

    return new Response(
      JSON.stringify({ resultados }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: true, mensaje: err instanceof Error ? err.message : 'Error interno' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
```

- [ ] **Step 2: Deploy function**

```bash
supabase functions deploy precios-mercadona --no-verify-jwt
```

- [ ] **Step 3: Smoke-test**

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/precios-mercadona \
  -H "Content-Type: application/json" \
  -d '{
    "ingredientes": [{"nombre": "lentejas", "cantidad": 400, "unidad": "g"}],
    "codigo_postal": "28001"
  }'
```

Expected: `{ resultados: [{ ingrediente: "lentejas", ..., sin_precio: false }] }` or `sin_precio: true` if no Mercadona match.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/precios-mercadona/
git commit -m "feat: edge function precios-mercadona with 3-layer cache"
```

---

### Task 10: Ingredient Row Component & Lista Screen

**Files:**
- Create: `src/components/IngredienteRow.tsx`
- Modify: `src/pages/Lista.tsx` (replace stub)

**Interfaces:**
- `IngredienteRow`: props `{ resultado: ResultadoPrecio, checked: boolean, onToggle: () => void }`
- `Lista.tsx`: aggregates ingredients from `menu_semana` in localStorage, deduplicates, calls `precios-mercadona`, displays totals

- [ ] **Step 1: Write `src/components/IngredienteRow.tsx`**

```tsx
// src/components/IngredienteRow.tsx
import type { ResultadoPrecio } from '../types'

interface Props {
  resultado: ResultadoPrecio
  checked: boolean
  onToggle: () => void
}

export function IngredienteRow({ resultado, checked, onToggle }: Props) {
  return (
    <label className={`flex items-start gap-3 py-2 cursor-pointer ${checked ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 w-4 h-4 rounded accent-green-select"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-medium text-sm ${checked ? 'line-through' : ''}`}>
            {resultado.ingrediente}
          </span>
          <span className="text-xs text-gray-400">
            {resultado.cantidad_necesaria} {resultado.unidad}
          </span>
          {resultado.sin_precio && (
            <span title="Precio no encontrado" className="text-xs text-orange-accent">⚠️</span>
          )}
        </div>
        {resultado.producto_mercadona && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {resultado.producto_mercadona} · {resultado.envases_a_comprar} ud.
            {resultado.sobrante ? ` (sobran ${resultado.sobrante} ${resultado.unidad_envase})` : ''}
          </p>
        )}
      </div>
      {resultado.coste_real !== undefined && (
        <span className="text-sm font-semibold shrink-0">
          {resultado.coste_real.toFixed(2)} €
        </span>
      )}
    </label>
  )
}
```

- [ ] **Step 2: Write `src/pages/Lista.tsx`**

```tsx
// src/pages/Lista.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IngredienteRow } from '../components/IngredienteRow'
import { Skeleton } from '../components/ui/Skeleton'
import { recuperar } from '../lib/storage'
import { usePerfil } from '../hooks/usePerfil'
import type { MenuSemanal, Ingrediente, ResultadoPrecio } from '../types'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/precios-mercadona`

const CATEGORIAS_ORDEN = [
  'Verduras y frutas',
  'Carnes y pescados',
  'Lácteos y huevos',
  'Legumbres y cereales',
  'Enlatados y conservas',
  'Otros',
]

function categorizar(nombre: string): string {
  const n = nombre.toLowerCase()
  if (/tomate|cebolla|ajo|pimiento|zanahoria|patata|espinaca|brócoli|lechuga|pepino|calabacín|berenjena|champiñon|limón|naranja|manzana|plátano|fruta|verdura|ensalada|acelga|puerro|coliflor/.test(n)) return 'Verduras y frutas'
  if (/pollo|ternera|cerdo|carne|bacalao|salmón|atún|merluza|gambas|mejillones|huevo|pechuga|filete|jamón|chorizo/.test(n)) return 'Carnes y pescados'
  if (/leche|queso|yogur|mantequilla|nata|crema|lácteo/.test(n)) return 'Lácteos y huevos'
  if (/lentejas|garbanzos|judías|arroz|pasta|macarrones|espagueti|harina|avena|pan|cereales/.test(n)) return 'Legumbres y cereales'
  if (/lata|conserva|tomate triturado|atún en lata|sardinas|caldo|bote|frasco/.test(n)) return 'Enlatados y conservas'
  return 'Otros'
}

function agregarIngredientes(menu: MenuSemanal, nevera: string[]): Ingrediente[] {
  const mapa = new Map<string, Ingrediente>()

  for (const receta of Object.values(menu)) {
    if (!receta) continue
    for (const ing of receta.ingredientes) {
      const clave = ing.nombre.toLowerCase().trim()
      // Skip if user already has it
      if (nevera.some(n => clave.includes(n.toLowerCase()))) continue

      const existing = mapa.get(clave)
      if (existing && existing.unidad === ing.unidad) {
        mapa.set(clave, { ...existing, cantidad: existing.cantidad + ing.cantidad })
      } else {
        mapa.set(clave, { ...ing })
      }
    }
  }

  return Array.from(mapa.values())
}

export default function Lista() {
  const navigate = useNavigate()
  const { perfil } = usePerfil()
  const [resultados, setResultados] = useState<ResultadoPrecio[]>([])
  const [cargando, setCargando] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const menu = recuperar<MenuSemanal>('menu_semana')
    if (!menu || !perfil) { setCargando(false); return }

    const ingredientes = agregarIngredientes(menu, perfil.nevera ?? [])

    fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredientes: ingredientes.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          unidad: i.unidad,
        })),
        codigo_postal: perfil.codigo_postal,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setResultados(data.resultados ?? [])
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [perfil])

  function toggleChecked(nombre: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(nombre) ? next.delete(nombre) : next.add(nombre)
      return next
    })
  }

  const total = resultados.reduce((sum, r) => sum + (r.coste_real ?? 0), 0)
  const sobrepresupuesto = perfil && total > perfil.presupuesto

  // Group by category
  const porCategoria = new Map<string, ResultadoPrecio[]>()
  for (const r of resultados) {
    const cat = categorizar(r.ingrediente)
    if (!porCategoria.has(cat)) porCategoria.set(cat, [])
    porCategoria.get(cat)!.push(r)
  }

  if (cargando) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">🛒 Lista de la compra</h1>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} lines={2} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto flex items-center justify-center">
        <p className="text-red-500">Error al cargar precios: {error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">🛒 Lista de la compra</h1>
        <button
          onClick={() => navigate('/menu')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Menú
        </button>
      </div>

      {sobrepresupuesto && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-card text-sm text-red-700 dark:text-red-300">
          ⚠️ Total estimado ({total.toFixed(2)} €) supera tu presupuesto de {perfil!.presupuesto} €
        </div>
      )}

      <div className="space-y-6">
        {CATEGORIAS_ORDEN.filter(cat => porCategoria.has(cat)).map(cat => (
          <div key={cat}>
            <h2 className="font-semibold text-gray-500 dark:text-gray-400 text-sm uppercase tracking-wide mb-2">
              {cat}
            </h2>
            <div className="bg-white dark:bg-gray-900 rounded-card border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {porCategoria.get(cat)!.map(r => (
                <div key={r.ingrediente} className="px-3">
                  <IngredienteRow
                    resultado={r}
                    checked={checked.has(r.ingrediente)}
                    onToggle={() => toggleChecked(r.ingrediente)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total estimado</p>
            <p className={`text-2xl font-bold ${sobrepresupuesto ? 'text-red-500' : 'text-green-select'}`}>
              {total.toFixed(2)} €
            </p>
            {perfil && (
              <p className="text-xs text-gray-400">
                {(total / 7 / perfil.personas).toFixed(2)} € / persona / día
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/exportar')}
            className="bg-orange-accent text-white rounded-card px-6 py-3 font-semibold hover:opacity-90"
          >
            Exportar →
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test end-to-end**

1. Complete onboarding → generate menu → select all 14 → click "Ver lista" → `/lista` shows ingredients with prices.
2. Tap checkboxes — items get struck through.
3. Budget exceeded warning shows in red if total > presupuesto.

- [ ] **Step 4: Commit**

```bash
git add src/components/IngredienteRow.tsx src/pages/Lista.tsx
git commit -m "feat: shopping list screen with Mercadona prices and budget alert"
```

---

### Task 11: Export Screen

**Files:**
- Modify: `src/pages/Exportar.tsx` (replace stub)

**Interfaces:**
- Consumes: `menu_semana` from localStorage, `precios-mercadona` results, Supabase `semanas` + `historial_recetas` tables, `jsPDF` + `html2canvas`
- Produces: saved semana row + historial, PDF download, clipboard text, public link

- [ ] **Step 1: Write `src/pages/Exportar.tsx`**

```tsx
// src/pages/Exportar.tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import { recuperar } from '../lib/storage'
import { usePerfil } from '../hooks/usePerfil'
import { useAuth } from '../hooks/useAuth'
import type { MenuSemanal } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

export default function Exportar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { perfil } = usePerfil()
  const exportRef = useRef<HTMLDivElement>(null)
  const [guardando, setGuardando] = useState(false)
  const [enlacePublico, setEnlacePublico] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [pdfGenerando, setPdfGenerando] = useState(false)

  const menu = recuperar<MenuSemanal>('menu_semana') ?? {}

  function buildTextoPlano(): string {
    let texto = '🥗 SEMANA LISTA — Mi menú semanal\n\n'
    for (const dia of DIAS) {
      texto += `${DIAS_LABEL[dia].toUpperCase()}\n`
      for (const franja of FRANJAS) {
        const receta = menu[`${dia}_${franja}`]
        if (receta) {
          texto += `  ${franja === 'comida' ? '🍽️ Comida' : '🌙 Cena'}: ${receta.nombre} (${receta.tiempo_prep} min)\n`
        }
      }
      texto += '\n'
    }
    return texto
  }

  async function copiarPortapapeles() {
    await navigator.clipboard.writeText(buildTextoPlano())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function generarPDF() {
    if (!exportRef.current) return
    setPdfGenerando(true)
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgRatio = canvas.height / canvas.width
      const imgH = pageW * imgRatio
      let yPos = 0
      let remaining = imgH

      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH)
        remaining -= pageH
        yPos += pageH
        if (remaining > 0) pdf.addPage()
      }

      pdf.save('semana-lista.pdf')
    } finally {
      setPdfGenerando(false)
    }
  }

  async function guardarYCompartir() {
    if (!user || !perfil) return
    setGuardando(true)

    try {
      // Save semana to DB
      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay() + 1) // this Monday

      const { data: semana } = await supabase
        .from('semanas')
        .insert({
          usuario_id: user.id,
          fecha_inicio: fechaInicio.toISOString().split('T')[0],
          recetas_elegidas: menu,
          lista_compra: [],
          es_publica: true,
        })
        .select()
        .single()

      // Save historial_recetas
      const recetas = Object.values(menu)
        .filter(Boolean)
        .map(r => ({ usuario_id: user.id, nombre_receta: r!.nombre, fecha_uso: fechaInicio.toISOString().split('T')[0] }))

      if (recetas.length) {
        await supabase.from('historial_recetas').insert(recetas)
      }

      const url = `${window.location.origin}/menu/${semana.id}`
      setEnlacePublico(url)
    } catch (err) {
      console.error('Error guardando semana:', err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">📤 Exportar</h1>
        <button onClick={() => navigate('/lista')} className="text-sm text-gray-500">← Lista</button>
      </div>

      <div className="space-y-3 mb-6">
        <button
          onClick={generarPDF}
          disabled={pdfGenerando}
          className="w-full bg-white dark:bg-gray-900 border rounded-card p-4 text-left hover:border-green-select transition-colors disabled:opacity-50 flex items-center gap-3"
        >
          <span className="text-2xl">📄</span>
          <div>
            <p className="font-semibold">Descargar PDF</p>
            <p className="text-sm text-gray-500">Menú semanal + lista de la compra</p>
          </div>
          {pdfGenerando && <span className="ml-auto text-sm text-gray-400">Generando...</span>}
        </button>

        <button
          onClick={copiarPortapapeles}
          className="w-full bg-white dark:bg-gray-900 border rounded-card p-4 text-left hover:border-green-select transition-colors flex items-center gap-3"
        >
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-semibold">{copiado ? '¡Copiado!' : 'Copiar para WhatsApp'}</p>
            <p className="text-sm text-gray-500">Texto plano del menú</p>
          </div>
        </button>

        <button
          onClick={guardarYCompartir}
          disabled={guardando || !!enlacePublico}
          className="w-full bg-white dark:bg-gray-900 border rounded-card p-4 text-left hover:border-green-select transition-colors disabled:opacity-50 flex items-center gap-3"
        >
          <span className="text-2xl">🔗</span>
          <div>
            <p className="font-semibold">Crear enlace público</p>
            <p className="text-sm text-gray-500">Guarda la semana y genera link</p>
          </div>
          {guardando && <span className="ml-auto text-sm text-gray-400">Guardando...</span>}
        </button>

        {enlacePublico && (
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-card">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Enlace creado:</p>
            <a href={enlacePublico} target="_blank" rel="noopener noreferrer"
              className="text-sm text-green-select hover:underline break-all">
              {enlacePublico}
            </a>
          </div>
        )}
      </div>

      {/* Printable content for PDF */}
      <div ref={exportRef} className="bg-white text-gray-900 p-6 rounded-card border">
        <h2 className="text-xl font-bold mb-4">🥗 Mi semana</h2>
        {DIAS.map(dia => (
          <div key={dia} className="mb-4">
            <h3 className="font-bold text-base mb-1">{DIAS_LABEL[dia]}</h3>
            {FRANJAS.map(franja => {
              const receta = menu[`${dia}_${franja}`]
              if (!receta) return null
              return (
                <p key={franja} className="text-sm mb-0.5 pl-2">
                  <strong>{franja === 'comida' ? 'Comida' : 'Cena'}:</strong>{' '}
                  {receta.nombre} ({receta.tiempo_prep} min · {receta.dificultad})
                </p>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/pages/MenuPublico.tsx`**

```tsx
// src/pages/MenuPublico.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { MenuSemanal } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

export default function MenuPublico() {
  const { semanaId } = useParams<{ semanaId: string }>()
  const [menu, setMenu] = useState<MenuSemanal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!semanaId) return
    supabase
      .from('semanas')
      .select('recetas_elegidas')
      .eq('id', semanaId)
      .eq('es_publica', true)
      .single()
      .then(({ data }) => {
        setMenu(data?.recetas_elegidas ?? null)
        setLoading(false)
      })
  }, [semanaId])

  if (loading) return <div className="p-8 text-center">Cargando...</div>
  if (!menu) return <div className="p-8 text-center text-gray-500">Menú no encontrado</div>

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">🥗 Menú compartido</h1>
      <div className="space-y-4">
        {DIAS.map(dia => (
          <div key={dia} className="bg-white dark:bg-gray-900 rounded-card border p-3">
            <h2 className="font-bold mb-2">{DIAS_LABEL[dia]}</h2>
            {FRANJAS.map(franja => {
              const receta = menu[`${dia}_${franja}`]
              return (
                <div key={franja} className="mb-1">
                  <span className="text-xs text-gray-400 capitalize">{franja}: </span>
                  <span className="text-sm">{receta?.nombre ?? '—'}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test export flow**

1. Navigate to `/exportar`
2. Click "Descargar PDF" → PDF file downloads with the week's menu
3. Click "Copiar para WhatsApp" → clipboard text copied (toast shows "¡Copiado!")
4. Click "Crear enlace público" → link appears; visit `/menu/<id>` — shows read-only menu

- [ ] **Step 4: Commit**

```bash
git add src/pages/Exportar.tsx src/pages/MenuPublico.tsx
git commit -m "feat: export screen with PDF, clipboard, and public link"
```

---

### Task 12: Deployment

**Files:**
- Create: `vercel.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: public Vercel URL; Supabase Edge Functions live in production

- [ ] **Step 1: Write `vercel.json`**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

(SPA catch-all so client-side routes work on Vercel.)

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
.env.local
.env.*.local
*.DS_Store
```

- [ ] **Step 3: Set Vercel environment variables**

In Vercel Dashboard → Project → Settings → Environment Variables:
```
VITE_SUPABASE_URL      = https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY = <anon key>
```

- [ ] **Step 4: Deploy to Vercel**

```bash
npm run build
npx vercel --prod
```

Or connect the GitHub repo in the Vercel Dashboard for auto-deploys.

- [ ] **Step 5: Verify Supabase Auth redirect URL**

In Supabase Dashboard → Authentication → URL Configuration → Site URL:
```
https://semana-lista.vercel.app
```

Add to Redirect URLs:
```
https://semana-lista.vercel.app/**
```

- [ ] **Step 6: Full smoke test on production**

1. Register new user → onboarding wizard → menu generation (all 14 cells)
2. Shopping list with prices → export PDF
3. Create public link → visit link in incognito → see read-only menu
4. Log back in as same user → `/menu` shows previous session from localStorage

- [ ] **Step 7: Final commit**

```bash
git add vercel.json .gitignore
git commit -m "feat: Vercel deployment config"
git push origin main
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered in |
|---|---|
| React + Vite + TailwindCSS | Task 1 |
| Supabase Auth (email + Google) | Task 3 |
| 6 DB tables with RLS | Task 2 |
| Edge Function generar-recetas | Task 6 |
| claude-haiku-4-5-20251001 + json_schema | Task 6 Step 1 |
| 14 parallel fetch calls | Task 8 |
| Skeleton loaders + fade-in | Tasks 4, 7 |
| "Reintentar" on cell error | Task 7 CeldaMenu |
| "Sorpréndeme" button | Task 8 Menu.tsx |
| Progress bar 14/14 | Tasks 4, 8 |
| precios-mercadona 3-layer cache | Task 9 |
| Packaging math ceil | Task 9 Step 1 |
| sin_precio: true (never invent) | Task 9 Step 1 |
| Shopping list grouped by category | Task 10 Lista.tsx |
| Budget alert | Task 10 Lista.tsx |
| Price per person/day | Task 10 Lista.tsx |
| PDF export | Task 11 |
| Clipboard (WhatsApp) | Task 11 |
| Public link /menu/:id | Tasks 11, 11 |
| historial_recetas saved | Task 11 |
| localStorage persistence | Tasks 1, 5, 8 |
| Dark mode via class | Task 1 App.tsx |
| ANTHROPIC_API_KEY in Edge Function only | Tasks 6, 9; never in VITE_* |
| Mobile-first layout | All pages use responsive Tailwind classes |
| Mercadona PUT almacén | Task 9 fijarAlmacen() |
| Mercadona unstable API isolated | Task 9 buscarProducto() |

**Security rule confirmed:** `ANTHROPIC_API_KEY` only appears in `supabase/functions/generar-recetas/index.ts` via `Deno.env.get()`. No `VITE_*` variable for secrets. Frontend only uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
