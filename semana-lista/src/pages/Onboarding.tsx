// src/pages/Onboarding.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TagInput } from '../components/ui/TagInput'
import { NeveraSearch } from '../components/ui/NeveraSearch'
import { ProgressBar } from '../components/ui/ProgressBar'
import { usePerfil } from '../hooks/usePerfil'
import { useUsuario } from '../hooks/useUsuario'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import type { Objetivo, DificultadPreferida, Perfil } from '../types'

const TOTAL_PASOS = 10

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
  const { t, lang, setLang } = useI18n()
  const navigate = useNavigate()
  const { guardarPerfil } = usePerfil()
  const { guardarUsuario } = useUsuario()
  const { user } = useAuth()
  const [paso, setPaso] = useState(1)

  const OBJETIVOS: { value: Objetivo; label: string; emoji: string }[] = [
    { value: 'sin_restriccion', label: t.obj_sin_restriccion, emoji: '🍽️' },
    { value: 'bajar_peso',      label: t.obj_bajar_peso,      emoji: '⚖️' },
    { value: 'mas_proteina',    label: t.obj_mas_proteina,    emoji: '💪' },
    { value: 'vegetariano',     label: t.obj_vegetariano,     emoji: '🥦' },
    { value: 'vegano',          label: t.obj_vegano,          emoji: '🌱' },
    { value: 'sin_gluten',      label: t.obj_sin_gluten,      emoji: '🌾' },
  ]

  const DIFICULTADES: { value: DificultadPreferida; label: string; emoji: string; desc: string }[] = [
    { value: 'fácil',     label: t.dif_facil,     emoji: '😊', desc: t.dif_onb_desc_facil },
    { value: 'media',     label: t.dif_media,     emoji: '👨‍🍳', desc: t.dif_onb_desc_media },
    { value: 'difícil',   label: t.dif_dificil,   emoji: '🔥', desc: t.dif_onb_desc_dificil },
    { value: 'combinado', label: t.dif_combinado, emoji: '🎲', desc: t.dif_onb_desc_combinado },
  ]
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
    t.ajustes_idioma,
    t.onb_tu_nombre,
    t.ajustes_personas,
    t.ajustes_presupuesto,
    t.ajustes_codigo_postal,
    t.ajustes_objetivo,
    t.ajustes_dificultad,
    t.ajustes_favoritos,
    t.ajustes_evitar,
    t.onb_paso9_pregunta,
  ][paso - 1]

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto page-enter">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-black tracking-tight mb-4">{t.onb_titulo}</h1>
        <ProgressBar value={paso} max={TOTAL_PASOS} label={pasoLabel} />
      </div>

      <div className="flex-1">
        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{lang === 'ca' ? 'En quin idioma vols usar l\'app?' : '¿En qué idioma quieres usar la app?'}</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'es' as const, label: 'Español', flag: (
                  <svg viewBox="0 0 24 24" width="28" height="28" className="rounded-full overflow-hidden shrink-0">
                    <rect width="24" height="24" fill="#c60b1e"/>
                    <rect y="6" width="24" height="12" fill="#ffc400"/>
                  </svg>
                )},
                { value: 'ca' as const, label: 'Català', flag: (
                  <svg viewBox="0 0 24 24" width="28" height="28" className="rounded-full overflow-hidden shrink-0">
                    <rect width="24" height="24" fill="#fcdd09"/>
                    <rect y="3"  width="24" height="3" fill="#da121a"/>
                    <rect y="9"  width="24" height="3" fill="#da121a"/>
                    <rect y="15" width="24" height="3" fill="#da121a"/>
                    <rect y="21" width="24" height="3" fill="#da121a"/>
                  </svg>
                )},
              ]).map(({ value, label, flag }) => (
                <button
                  key={value}
                  onClick={() => { setLang(value); setPaso(2) }}
                  className={`flex items-center justify-center gap-2 py-4 rounded-card border-2 text-base font-semibold transition-colors ${
                    lang === value
                      ? 'border-green-select bg-accent-light text-green-select'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-green-select'
                  }`}
                >
                  {flag}
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso1_pregunta}</p>
            <input
              type="text"
              value={nombreDisplay}
              onChange={e => setNombreDisplay(e.target.value)}
              placeholder={t.onb_paso1_ph}
              maxLength={40}
              autoFocus
              className="w-full border-2 rounded-card px-4 py-3 text-xl bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
            />
            {nombreGoogle && (
              <p className="text-xs text-gray-400">{t.onb_paso1_google}</p>
            )}
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso2_pregunta}</p>
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

        {paso === 4 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso3_pregunta}</p>
            <input
              type="number"
              min={20}
              max={500}
              value={draft.presupuesto}
              onChange={e => set('presupuesto', Number(e.target.value))}
              className="w-full border-2 rounded-card px-4 py-3 text-2xl font-bold text-center bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
            />
            <p className="text-sm text-gray-400">{t.onb_paso3_rec}</p>
          </div>
        )}

        {paso === 5 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso4_pregunta}</p>
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

        {paso === 6 && (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso5_pregunta}</p>
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

        {paso === 7 && (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso6_pregunta}</p>
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

        {paso === 8 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso7_pregunta}</p>
            <TagInput
              tags={draft.ingredientes_si}
              onChange={tags => set('ingredientes_si', tags)}
              placeholder={t.onb_paso7_ph}
            />
          </div>
        )}

        {paso === 9 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso8_pregunta}</p>
            <TagInput
              tags={draft.ingredientes_no}
              onChange={tags => set('ingredientes_no', tags)}
              placeholder={t.onb_paso8_ph}
            />
          </div>
        )}

        {paso === 10 && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t.onb_paso9_pregunta}</p>
            <NeveraSearch
              items={draft.nevera}
              onChange={items => set('nevera', items)}
              placeholder={t.onb_paso9_ph}
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
            {t.onb_atras}
          </button>
        )}
        {paso < TOTAL_PASOS ? (
          <button
            onClick={() => setPaso(p => p + 1)}
            disabled={paso === 5 && draft.codigo_postal.length !== 5}
            className="flex-1 bg-green-select text-white rounded-card py-3 font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            {t.onb_siguiente}
          </button>
        ) : (
          <button
            onClick={finalizar}
            disabled={guardando}
            className="flex-1 bg-orange-accent text-white rounded-card py-3 font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? t.onb_guardando : t.onb_empezar}
          </button>
        )}
      </div>
    </div>
  )
}
