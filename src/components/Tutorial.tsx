import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'

export const TUTORIAL_STORAGE_KEY = 'semana-lista:tutorial-seen-v1'
export const TUTORIAL_EVENT = 'semana-lista:open-tutorial'

interface Paso {
  ruta: string
  emoji: string
  titulo: string
  desc: string
  chips?: string[]
  selector?: string
  clickBefore?: string
  scrollTo?: boolean
}

const PASOS: Paso[] = [
  {
    ruta: '/menu',
    emoji: '👋',
    titulo: '¡Bienvenido a Semana Lista!',
    desc: 'Tu planificador semanal inteligente. En segundos tienes menú completo, recetas paso a paso, ingredientes agrupados y precios reales de Mercadona. Te enseñamos todo en un minuto.',
    chips: ['🤖 IA', '🛒 Mercadona', '👨‍👩‍👧 Familiar', '📱 Fácil'],
  },
  {
    ruta: '/menu',
    emoji: '✨',
    titulo: 'Genera tu menú en segundos',
    desc: 'Pulsa "Generar ✨" para elegir tipo de cocina (mediterránea, asiática, vegetariana…), días de la semana, comidas y dificultad. La IA crea recetas reales con ingredientes y calorías. Tienes 15 generaciones gratis al mes.',
    chips: ['🍽️ Cocina a elegir', '📅 Días flexibles', '🎁 15 gratis/mes'],
    selector: '[data-tutorial="generar-btn"]',
  },
  {
    ruta: '/menu',
    emoji: '⭐',
    titulo: 'Controla y personaliza cada receta',
    desc: 'Guarda favoritas ⭐ para que la IA las repita, pide una alternativa ➕ para elegir entre dos opciones, o marca 👎 lo que no te gusta para que la IA lo evite. Pulsa "📖 Ver receta" para ver los pasos completos de cocina.',
    chips: ['⭐ Favoritas', '➕ Alternativa', '👎 No me gusta', '📖 Pasos'],
    selector: '[data-tutorial="receta-acciones"]',
  },
  {
    ruta: '/lista',
    emoji: '🛒',
    titulo: 'Tu lista se genera sola',
    desc: 'Los ingredientes de todas tus recetas aparecen aquí automáticamente, agrupados por categoría con precio real de Mercadona. Toca cualquier producto para marcarlo como comprado — aparece tachado. El total se actualiza en tiempo real; pulsa en él para fijar un presupuesto semanal.',
    chips: ['📋 Auto-generada', '☑️ Toca para comprar', '💰 Presupuesto'],
    selector: '[data-tutorial="lista-cabecera"]',
  },
  {
    ruta: '/lista',
    emoji: '🏠',
    titulo: 'Lo que ya tienes en casa',
    desc: 'Pulsa 🏠 junto a un ingrediente para marcarlo como "en casa" — se descuenta del presupuesto. Desde la sección En Casa puedes mover productos directamente al carrito de la compra con 🛒.',
    chips: ['🏠 En casa', '💸 Ahorro automático', '🛒 Al carrito'],
    selector: '[data-tutorial="en-casa"]',
    clickBefore: '[data-tutorial="en-casa-btn"]',
    scrollTo: true,
  },
  {
    ruta: '/lista',
    emoji: '🔍',
    titulo: 'Añade cualquier producto',
    desc: 'Filtra la lista por categoría con el botón "Categoría ▾". Para añadir extras: busca entre 4.600 productos de Mercadona con precio real, o pulsa "Producto personalizado" para escribir uno manualmente.',
    chips: ['🏷️ Por categoría', '4.600 productos', '✏️ Manual'],
    selector: '[data-tutorial="add-custom"]',
    scrollTo: true,
  },
  {
    ruta: '/lista',
    emoji: '👥',
    titulo: 'Comparte con tu familia',
    desc: 'Pulsa "Compartida" para crear una lista familiar o unirte con un código. Todos ven y editan la misma lista en tiempo real.',
    chips: ['🔗 Código único', '⚡ Tiempo real', '👨‍👩‍👧 Familia'],
    selector: '[data-tutorial="compartida-btn"]',
  },
  {
    ruta: '/ajustes',
    emoji: '⚙️',
    titulo: 'Ajusta todo a tu medida',
    desc: 'Controla el número de personas para que las raciones sean exactas, fija tu presupuesto semanal, tu objetivo de calorías y tu nombre en las listas compartidas.',
    chips: ['👥 Personas', '💵 Presupuesto', '🔥 Calorías'],
    selector: '[data-tutorial="ajustes-h1"]',
  },
]

function themeFor(ruta: string) {
  if (ruta.startsWith('/lista') || ruta.startsWith('/compartida')) {
    return {
      grad: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      gradWelcome: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #1e3a8a 100%)',
      glow: 'rgba(59,130,246,0.55)',
      border: '#3b82f6',
      chip: 'rgba(219,234,254,0.95)',
      chipText: '#1e40af',
      label: '🛒 LISTA',
      dot: '#3b82f6',
      dotPast: '#93c5fd',
    }
  }
  if (ruta.startsWith('/ajustes')) {
    return {
      grad: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      gradWelcome: 'linear-gradient(135deg, #5b21b6 0%, #6d28d9 50%, #4c1d95 100%)',
      glow: 'rgba(139,92,246,0.55)',
      border: '#8b5cf6',
      chip: 'rgba(237,233,254,0.95)',
      chipText: '#5b21b6',
      label: '⚙️ AJUSTES',
      dot: '#8b5cf6',
      dotPast: '#c4b5fd',
    }
  }
  return {
    grad: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
    gradWelcome: 'linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)',
    glow: 'rgba(34,197,94,0.55)',
    border: '#22c55e',
    chip: 'rgba(220,252,231,0.95)',
    chipText: '#15803d',
    label: '🍽️ MENÚ',
    dot: '#22c55e',
    dotPast: '#86efac',
  }
}

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const DUR = '380ms'
const PAD = 10

export function Tutorial() {
  const navigate = useNavigate()
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [paso, setPaso] = useState(0)
  const [spotRect, setSpotRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [cardSide, setCardSide] = useState<'top' | 'bottom'>('bottom')
  const [arrowX, setArrowX] = useState(50)
  const [fadeCard, setFadeCard] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const findRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduledRef = useRef(false)
  const elevatedRef = useRef<{ el: HTMLElement; z: string } | null>(null)

  function resetElevation() {
    if (elevatedRef.current) {
      elevatedRef.current.el.style.zIndex = elevatedRef.current.z
      elevatedRef.current = null
    }
  }

  function elevateSticky(el: HTMLElement) {
    resetElevation()
    let parent = el.parentElement
    while (parent && parent !== document.body) {
      const pos = window.getComputedStyle(parent).position
      if (pos === 'sticky' || pos === 'fixed') {
        const z = parent.style.zIndex
        parent.style.zIndex = '51'
        elevatedRef.current = { el: parent, z }
        break
      }
      parent = parent.parentElement
    }
  }

  // Auto-open solo justo después del onboarding (flag en navigation state)
  useEffect(() => {
    if (scheduledRef.current) return
    if (localStorage.getItem(TUTORIAL_STORAGE_KEY)) return
    const state = location.state as { tutorialFirstRun?: boolean } | null
    if (!state?.tutorialFirstRun) return
    scheduledRef.current = true
    const t = setTimeout(() => setVisible(true), 700)
    return () => clearTimeout(t)
  }, [location.state])

  // Escuchar botón ?
  useEffect(() => {
    function onOpen() { setPaso(0); setSpotRect(null); setVisible(true) }
    window.addEventListener(TUTORIAL_EVENT, onOpen)
    return () => window.removeEventListener(TUTORIAL_EVENT, onOpen)
  }, [])

  // Teclado
  useEffect(() => {
    if (!visible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); avanzar() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (paso > 0) cambiarPaso(paso - 1) }
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, paso]) // eslint-disable-line

  // Navegar cuando cambia el paso
  useEffect(() => {
    if (!visible) return
    const ruta = PASOS[paso].ruta
    if (location.pathname !== ruta) navigate(ruta)
  }, [paso, visible]) // eslint-disable-line

  // Buscar el elemento objetivo
  const buscarElemento = useCallback(() => {
    if (findRef.current) clearTimeout(findRef.current)
    const sel = PASOS[paso].selector
    const clickBefore = PASOS[paso].clickBefore

    if (!sel) { setSpotRect(null); return }

    const startPolling = () => {
      let attempts = 0
      const tryFind = () => {
        const el = document.querySelector(sel) as HTMLElement | null
        if (el) {
          if (PASOS[paso].scrollTo) {
            el.scrollIntoView({ behavior: 'instant', block: 'center' })
          }
          const delay = PASOS[paso].scrollTo ? 150 : 100
          findRef.current = setTimeout(() => {
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
              elevateSticky(el)
              const x = rect.left - PAD
              const y = rect.top - PAD
              const w = rect.width + PAD * 2
              const h = rect.height + PAD * 2
              setSpotRect({ x, y, w, h })
              const midScreen = window.innerHeight / 2
              const midEl = rect.top + rect.height / 2
              setCardSide(midEl < midScreen ? 'bottom' : 'top')
              const ax = Math.max(10, Math.min(90, ((rect.left + rect.width / 2) / window.innerWidth) * 100))
              setArrowX(ax)
            } else if (attempts < 6) {
              attempts++
              findRef.current = setTimeout(tryFind, 250)
            }
          }, delay)
        } else if (attempts < 8) {
          attempts++
          findRef.current = setTimeout(tryFind, 200)
        }
      }
      findRef.current = setTimeout(tryFind, 350)
    }

    if (clickBefore) {
      const trigger = document.querySelector(clickBefore) as HTMLElement | null
      if (trigger) {
        trigger.click()
        findRef.current = setTimeout(startPolling, 420)
      } else {
        startPolling()
      }
    } else {
      startPolling()
    }
  }, [paso])

  useEffect(() => {
    if (!visible) return
    setFadeCard(false)
    setTimeout(() => { buscarElemento(); setFadeCard(true) }, 150)
    return () => { if (findRef.current) clearTimeout(findRef.current) }
  }, [paso, visible, location.pathname, buscarElemento])

  function cerrar() {
    resetElevation()
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
    setFadeCard(false)
    setTimeout(() => { setVisible(false); setSpotRect(null) }, 300)
  }

  function cambiarPaso(next: number) {
    if (transitioning) return
    resetElevation()
    setTransitioning(true)
    setFadeCard(false)
    setSpotRect(null)
    setTimeout(() => { setPaso(next); setTransitioning(false) }, 300)
  }

  function avanzar() {
    if (paso < PASOS.length - 1) cambiarPaso(paso + 1)
    else cerrar()
  }

  if (!visible) return null

  const pasoActual = PASOS[paso]
  const esUltimo = paso === PASOS.length - 1
  const esWelcome = paso === 0
  const theme = themeFor(pasoActual.ruta)
  const NAV = 72
  const CARD_MARGIN = 14
  const progress = ((paso + 1) / PASOS.length) * 100

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    left: CARD_MARGIN,
    right: CARD_MARGIN,
    zIndex: 52,
    maxWidth: 500,
    margin: '0 auto',
    transition: `opacity ${DUR} ${EASE}, transform ${DUR} ${EASE}`,
    opacity: fadeCard ? 1 : 0,
    transform: fadeCard ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.98)',
  }

  if (!spotRect || esWelcome) {
    cardStyle.bottom = NAV + CARD_MARGIN
  } else if (cardSide === 'bottom') {
    cardStyle.bottom = NAV + CARD_MARGIN
  } else {
    cardStyle.top = CARD_MARGIN * 2
  }

  return createPortal(
    <>
      {/* ── Overlay oscuro con corte SVG ─────────────────────────── */}
      {spotRect && !esWelcome ? (
        <svg
          style={{ position: 'fixed', inset: 0, zIndex: 49, cursor: 'pointer' }}
          width="100%" height="100%"
          onClick={cerrar}
        >
          <defs>
            <mask id="tut-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                style={{ transition: `x ${DUR} ${EASE}, y ${DUR} ${EASE}, width ${DUR} ${EASE}, height ${DUR} ${EASE}` }}
                x={spotRect.x} y={spotRect.y}
                width={spotRect.w} height={spotRect.h}
                rx={12} ry={12}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.80)" mask="url(#tut-mask)" />
        </svg>
      ) : (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.85)', cursor: 'pointer' }}
          onClick={cerrar}
        />
      )}

      {/* ── Borde pulsante alrededor del spotlight ────────────────── */}
      {spotRect && !esWelcome && (
        <div
          style={{
            position: 'fixed',
            left: spotRect.x - 3, top: spotRect.y - 3,
            width: spotRect.w + 6, height: spotRect.h + 6,
            borderRadius: 14,
            border: `2.5px solid ${theme.border}`,
            boxShadow: `0 0 0 4px ${theme.glow.replace('0.55', '0.2')}, 0 0 20px ${theme.glow}`,
            zIndex: 50,
            pointerEvents: 'none',
            transition: `left ${DUR} ${EASE}, top ${DUR} ${EASE}, width ${DUR} ${EASE}, height ${DUR} ${EASE}`,
            animation: 'tut-glow 2.2s ease-in-out infinite',
          }}
        />
      )}

      {/* ── Card del tutorial ─────────────────────────────────────── */}
      <div style={cardStyle} onClick={e => e.stopPropagation()}>

        {/* Flecha en el borde de la card apuntando al elemento */}
        {spotRect && !esWelcome && cardSide === 'bottom' && (
          <div style={{
            position: 'absolute', top: -13, zIndex: 1,
            left: `${arrowX}%`, transform: 'translateX(-50%)',
            transition: `left ${DUR} ${EASE}`,
          }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '13px solid transparent',
              borderRight: '13px solid transparent',
              borderBottom: '14px solid #ffffff',
              filter: 'drop-shadow(0 -2px 4px rgba(0,0,0,0.25))',
            }} />
          </div>
        )}
        {spotRect && !esWelcome && cardSide === 'top' && (
          <div style={{
            position: 'absolute', bottom: -13, zIndex: 1,
            left: `${arrowX}%`, transform: 'translateX(-50%)',
            transition: `left ${DUR} ${EASE}`,
          }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '13px solid transparent',
              borderRight: '13px solid transparent',
              borderTop: '14px solid #ffffff',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
            }} />
          </div>
        )}

        <div style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 28px 70px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.25)' }}>

          {/* Barra de progreso */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${progress}%`,
              background: 'rgba(255,255,255,0.9)',
              transition: `width 400ms ${EASE}`,
              borderRadius: '0 2px 2px 0',
            }} />
          </div>

          {/* Cabecera */}
          <div style={{
            background: esWelcome ? theme.gradWelcome : theme.grad,
            padding: esWelcome ? '26px 22px 22px' : '18px 22px 16px',
          }}>
            {/* Etiqueta de sección */}
            {!esWelcome && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.18)', borderRadius: 20,
                padding: '2px 10px', marginBottom: 10,
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.08em', backdropFilter: 'blur(8px)',
              }}>
                {theme.label}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {/* Emoji con fondo glass */}
              <div style={{
                width: esWelcome ? 68 : 52, height: esWelcome ? 68 : 52,
                borderRadius: esWelcome ? 22 : 17,
                background: 'rgba(255,255,255,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: esWelcome ? 34 : 26, flexShrink: 0,
                backdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                animation: esWelcome ? 'tut-bob 3s ease-in-out infinite' : undefined,
              }}>
                {pasoActual.emoji}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: 'white', fontWeight: 800,
                  fontSize: esWelcome ? 22 : 18,
                  lineHeight: 1.25, margin: 0, marginBottom: 7,
                  textShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}>
                  {pasoActual.titulo}
                </p>
                <p style={{
                  color: 'rgba(255,255,255,0.88)', fontSize: 14.5,
                  lineHeight: 1.65, margin: 0,
                }}>
                  {pasoActual.desc}
                </p>

                {/* Chips de funciones */}
                {pasoActual.chips && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
                    {pasoActual.chips.map(chip => (
                      <span key={chip} style={{
                        background: 'rgba(255,255,255,0.2)',
                        color: 'rgba(255,255,255,0.95)',
                        fontSize: 11, fontWeight: 700,
                        padding: '3px 9px', borderRadius: 20,
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.25)',
                        whiteSpace: 'nowrap',
                      }}>
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Cerrar */}
              <button
                onClick={cerrar}
                style={{
                  background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 9, color: 'rgba(255,255,255,0.8)', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 13, flexShrink: 0,
                  backdropFilter: 'blur(8px)', transition: 'all 0.2s',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            background: 'white',
            padding: '13px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            {/* Puntos de progreso */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              {PASOS.map((p, i) => {
                const t = themeFor(p.ruta)
                return (
                  <button
                    key={i}
                    onClick={() => cambiarPaso(i)}
                    title={PASOS[i].titulo}
                    style={{
                      borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                      transition: `all ${DUR} ${EASE}`,
                      width: i === paso ? 18 : 7,
                      height: 7,
                      background: i === paso ? t.dot : i < paso ? t.dotPast : '#e5e7eb',
                      opacity: i === paso ? 1 : 0.7,
                    }}
                  />
                )
              })}
            </div>

            {/* Contador + botones */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>
                {paso + 1}<span style={{ fontWeight: 400 }}>/{PASOS.length}</span>
              </span>
              <button
                onClick={cerrar}
                style={{
                  background: 'transparent', border: '1.5px solid #e5e7eb',
                  borderRadius: 10, padding: '7px 11px', fontSize: 12,
                  color: '#9ca3af', cursor: 'pointer', fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                Saltar
              </button>
              {paso > 0 && (
                <button
                  onClick={() => cambiarPaso(paso - 1)}
                  style={{
                    background: 'transparent', border: '1.5px solid #e5e7eb',
                    borderRadius: 10, padding: '7px 13px', fontSize: 12,
                    color: '#6b7280', cursor: 'pointer', fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                >
                  ← Atrás
                </button>
              )}
              <button
                onClick={avanzar}
                style={{
                  background: themeFor(pasoActual.ruta).grad,
                  border: 'none', borderRadius: 10, padding: '8px 16px',
                  fontSize: 13, color: 'white', cursor: 'pointer',
                  fontWeight: 700, boxShadow: `0 4px 14px ${theme.glow}`,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {esUltimo ? '¡Empezar! 🚀' : 'Siguiente →'}
              </button>
            </div>
          </div>
        </div>

      </div>


      <style>{`
        @keyframes tut-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
        @keyframes tut-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </>,
    document.body,
  )
}
