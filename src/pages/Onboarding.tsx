// src/pages/Onboarding.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TagInput } from '../components/ui/TagInput'
import { ProgressBar } from '../components/ui/ProgressBar'
import { usePerfil } from '../hooks/usePerfil'
import { useUsuario } from '../hooks/useUsuario'
import { useAuth } from '../hooks/useAuth'
import type { Objetivo, DificultadPreferida, Perfil } from '../types'

const OBJETIVOS: { value: Objetivo; label: string; emoji: string }[] = [
  { value: 'sin_restriccion', label: 'Sin restricciones', emoji: '🍽️' },
  { value: 'bajar_peso',      label: 'Bajar peso',        emoji: '⚖️' },
  { value: 'mas_proteina',    label: 'Más proteína',      emoji: '💪' },
  { value: 'vegetariano',     label: 'Vegetariano',       emoji: '🥦' },
  { value: 'vegano',          label: 'Vegano',            emoji: '🌱' },
  { value: 'sin_gluten',      label: 'Sin gluten',        emoji: '🌾' },
]

const DIFICULTADES: { value: DificultadPreferida; label: string; emoji: string; desc: string }[] = [
  { value: 'fácil',     label: 'Fácil',     emoji: '😊', desc: 'Simples, ≤30 min' },
  { value: 'media',     label: 'Media',     emoji: '👨‍🍳', desc: '30–60 min' },
  { value: 'difícil',   label: 'Difícil',   emoji: '🔥', desc: 'Elaboradas' },
  { value: 'combinado', label: 'Combinado', emoji: '🎲', desc: 'Variedad máxima' },
]

const TOTAL_PASOS = 9

type Draft = Omit<Perfil, 'id' | 'usuario_id'>

const DRAFT_INICIAL: Draft = {
  personas: 2,
  presupuesto: 100,
  codigo_postal: '',
  supermercado: 'mercadona',
  objetivo: 'sin_restriccion',
  dificultad_recetas: 'combinado',
  ingredientes_si: [],
  ingredientes_no: [],
  nevera: [],
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { guardarPerfil } = usePerfil()
  const { guardarUsuario } = useUsuario()
  const { user } = useAuth()
  const [paso, setPaso] = useState(1)
  const [draft, setDraft] = useState<Draft>(DRAFT_INICIAL)
  const [guardando, setGuardando] = useState(false)

  // Nombre para mostrar (paso 1)
  const nombreGoogle = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
  const [nombreDisplay, setNombreDisplay] = useState(nombreGoogle)

  function set<K extends keyof Draft>(key: K, val: Draft[K]) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  async function finalizar() {
    setGuardando(true)
    await Promise.all([
      guardarPerfil(draft),
      nombreDisplay.trim() ? guardarUsuario({ nombre_display: nombreDisplay.trim() }) : Promise.resolve(),
    ])
    navigate('/menu', { replace: true, state: { tutorialFirstRun: true } })
  }

  const pasoLabel = [
    'Tu nombre',
    'Personas en el hogar',
    'Presupuesto semanal',
    'Código postal',
    'Objetivo nutricional',
    'Dificultad de las recetas',
    'Ingredientes favoritos',
    'Ingredientes a evitar',
    '¿Qué tienes en la nevera?',
  ][paso - 1]

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto page-enter">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-black tracking-tight mb-4">Cuéntanos sobre ti</h1>
        <ProgressBar value={paso} max={TOTAL_PASOS} label={pasoLabel} />
      </div>

      <div className="flex-1">
        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">¿Cómo te llamamos? Esto es lo que verán el resto de miembros de tus listas compartidas.</p>
            <input
              type="text"
              value={nombreDisplay}
              onChange={e => setNombreDisplay(e.target.value)}
              placeholder="Tu nombre o apodo"
              maxLength={40}
              autoFocus
              className="w-full border-2 rounded-card px-4 py-3 text-xl bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
            />
            {nombreGoogle && (
              <p className="text-xs text-gray-400">Pre-rellenado con tu nombre de Google. Cámbialo si quieres.</p>
            )}
          </div>
        )}

        {paso === 2 && (
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

        {paso === 3 && (
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

        {paso === 4 && (
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

        {paso === 5 && (
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

        {paso === 6 && (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">¿Qué nivel de dificultad prefieres en las recetas?</p>
            <div className="grid grid-cols-2 gap-2">
              {DIFICULTADES.map(d => (
                <button
                  key={d.value}
                  onClick={() => set('dificultad_recetas', d.value)}
                  className={`flex flex-col gap-0.5 px-3 py-3 rounded-card border-2 text-left transition-colors ${
                    draft.dificultad_recetas === d.value
                      ? 'border-green-select bg-green-50 dark:bg-green-900'
                      : 'border-gray-200 dark:border-gray-700 hover:border-green-select'
                  }`}
                >
                  <span className="text-base">{d.emoji} <span className="font-semibold">{d.label}</span></span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 7 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">Ingredientes que te gustan o usas frecuentemente</p>
            <TagInput
              tags={draft.ingredientes_si}
              onChange={tags => set('ingredientes_si', tags)}
              placeholder="p.ej. pollo, lentejas, tomate..."
            />
          </div>
        )}

        {paso === 8 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">Ingredientes que NO quieres en tus menús</p>
            <TagInput
              tags={draft.ingredientes_no}
              onChange={tags => set('ingredientes_no', tags)}
              placeholder="p.ej. marisco, cilantro..."
            />
          </div>
        )}

        {paso === 9 && (
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
            disabled={paso === 4 && draft.codigo_postal.length !== 5}
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
