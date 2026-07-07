import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../hooks/useI18n'

const MENU_EJEMPLO = [
  { dia: 'Lun', comida: { emoji: '🍗', nombre: 'Pollo al ajillo', kcal: 420 }, cena: { emoji: '🥣', nombre: 'Crema de calabaza', kcal: 280 } },
  { dia: 'Mar', comida: { emoji: '🍝', nombre: 'Pasta carbonara', kcal: 510 }, cena: { emoji: '🥗', nombre: 'Ensalada griega', kcal: 220 } },
  { dia: 'Mié', comida: { emoji: '🫘', nombre: 'Lentejas estofadas', kcal: 390 }, cena: { emoji: '🍳', nombre: 'Tortilla de patatas', kcal: 310 } },
  { dia: 'Jue', comida: { emoji: '🐟', nombre: 'Salmón al horno', kcal: 380 }, cena: { emoji: '🍲', nombre: 'Sopa de fideos', kcal: 250 } },
  { dia: 'Vie', comida: { emoji: '🍕', nombre: 'Pizza casera', kcal: 560 }, cena: { emoji: '🥗', nombre: 'Gazpacho con tosta', kcal: 190 } },
]

const INGREDIENTES_EJEMPLO = [
  'Pechuga de pollo', 'Pasta', 'Salmón fresco', 'Lentejas', 'Huevos',
  'Patatas', 'Tomates', 'Cebolla', 'Ajo', 'Calabaza', 'Nata líquida',
  'Queso parmesano', 'Pepino', 'Aceitunas negras', 'Fideos',
]

interface Props {
  onClose: () => void
}

export function TutorialMenu({ onClose }: Props) {
  const { t } = useI18n()
  const [paso, setPaso] = useState(0)
  const [saliendo, setSaliendo] = useState(false)
  const [slideDir, setSlideDir] = useState<1 | -1>(1)
  const [animando, setAnimando] = useState(false)
  const [visible, setVisible] = useState(true)

  const PASOS = [
    {
      titulo: t.tutmenu_paso1_titulo,
      subtitulo: t.tutmenu_titulo,
      contenido: 'menu',
    },
    {
      titulo: t.tutmenu_paso2_titulo,
      subtitulo: t.tutmenu_paso2_desc,
      contenido: 'opciones',
    },
    {
      titulo: t.tutmenu_paso3_titulo,
      subtitulo: t.tutmenu_paso3_desc,
      contenido: 'lista',
    },
  ]

  function irA(next: number) {
    if (animando) return
    setAnimando(true)
    setSlideDir(next > paso ? 1 : -1)
    setVisible(false)
    setTimeout(() => {
      setPaso(next)
      setVisible(true)
      setAnimando(false)
    }, 220)
  }

  function siguiente() {
    if (paso < PASOS.length - 1) { irA(paso + 1) } else { cerrar() }
  }
  function cerrar() {
    setSaliendo(true)
    setTimeout(onClose, 300)
  }

  const p = PASOS[paso]

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${saliendo ? 'opacity-0' : 'opacity-100'} p-4`}>
      <div className={`bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl transition-all duration-300 ${saliendo ? 'translate-y-8 opacity-0' : 'translate-y-0 opacity-100'} overflow-hidden`}>

        {/* Barra de progreso */}
        <div className="flex gap-1.5 p-4 pb-0">
          {PASOS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= paso ? 'bg-green-select' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>

        {/* Cabecera */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-base leading-tight">{p.titulo}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{p.subtitulo}</p>
            </div>
            <button onClick={cerrar} className="text-gray-300 hover:text-gray-500 text-xl leading-none ml-2 shrink-0">✕</button>
          </div>
        </div>

        {/* Contenido dinámico */}
        <div
          className="px-5 pb-5"
          style={{
            transition: 'opacity 200ms ease, transform 200ms ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : `translateX(${slideDir * 18}px)`,
          }}
        >

          {/* PASO 1 — Menú de ejemplo */}
          {p.contenido === 'menu' && (
            <div className="mt-2 space-y-1.5">
              {MENU_EJEMPLO.map(({ dia, comida, cena }) => (
                <div key={dia} className="flex gap-1.5 items-stretch">
                  <div className="w-8 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase shrink-0">{dia}</div>
                  <div className="flex-1 bg-accent-light border border-green-100 dark:border-green-800 rounded-xl px-2.5 py-1.5">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{comida.emoji} {comida.nombre}</p>
                    <p className="text-[10px] text-gray-400">🔥 {comida.kcal} kcal</p>
                  </div>
                  <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-2.5 py-1.5">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{cena.emoji} {cena.nombre}</p>
                    <p className="text-[10px] text-gray-400">🔥 {cena.kcal} kcal</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-center text-gray-400 mt-2">{t.tutmenu_ejemplo}</p>
            </div>
          )}

          {/* PASO 2 — Opciones por celda */}
          {p.contenido === 'opciones' && (
            <div className="mt-3 space-y-3">
              <div className="bg-accent-light border border-green-200 dark:border-green-800 rounded-2xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Lunes · Comida</p>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-bold">🍗 Pollo al ajillo</p>
                  <div className="flex gap-1">
                    <span className="text-yellow-400 text-sm">⭐</span>
                    <span className="text-gray-300 text-sm">✕</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-2">Tierno pollo en salsa de ajo y vino blanco. Listo en 25 min.</p>
                <div className="flex gap-2">
                  <span className="text-[10px] bg-accent-light text-green-select px-2 py-0.5 rounded-full font-medium">Fácil</span>
                  <span className="text-xs text-gray-400">⏱ 25 min</span>
                  <span className="text-xs text-gray-400">🔥 420 kcal/p</span>
                </div>
                <div className="mt-2 flex gap-2 border-t border-green-100 dark:border-green-800 pt-2">
                  <button className="text-xs bg-green-select text-white px-2 py-0.5 rounded-lg font-medium flex-1 text-center">Opción 1</button>
                  <button className="text-xs text-gray-400 px-2 py-0.5 rounded-lg flex-1 text-center">Opción 2</button>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className="text-lg mb-0.5">⭐</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">{t.tutmenu_guardar_fav}</p>
                  <p className="text-[10px] mt-0.5">{t.tutmenu_la_ia}</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className="text-lg mb-0.5">➕</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">{t.tutmenu_otra_opcion}</p>
                  <p className="text-[10px] mt-0.5">{t.tutmenu_genera_alt}</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className="text-lg mb-0.5">👎</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">{t.tutmenu_no_gusta}</p>
                  <p className="text-[10px] mt-0.5">{t.tutmenu_evita}</p>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3 — Lista de ingredientes */}
          {p.contenido === 'lista' && (
            <div className="mt-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{t.tutmenu_del_menu}</p>
                <div className="flex flex-wrap gap-1.5">
                  {INGREDIENTES_EJEMPLO.map(ing => (
                    <span key={ing} className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-full">{ing}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className="text-base mb-0.5">🏠</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">{t.tutmenu_en_casa_label}</p>
                  <p className="text-[10px] mt-0.5">{t.tutmenu_marca_tienes}</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className="text-base mb-0.5">✓</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">{t.tutmenu_comprado}</p>
                  <p className="text-[10px] mt-0.5">{t.tutmenu_tachado}</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className="text-base mb-0.5">👥</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">{t.tutmenu_compartida_label}</p>
                  <p className="text-[10px] mt-0.5">{t.tutmenu_para_familia}</p>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 mt-4">
            {paso > 0 && (
              <button
                onClick={() => irA(paso - 1)}
                className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t.btn_volver}
              </button>
            )}
            <button
              onClick={siguiente}
              className="flex-1 bg-green-select hover:opacity-90 text-white rounded-xl py-2.5 text-sm font-bold transition-all"
            >
              {paso < PASOS.length - 1 ? t.tutmenu_siguiente : t.tutmenu_empezar}
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-2">{paso + 1} de {PASOS.length}</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
