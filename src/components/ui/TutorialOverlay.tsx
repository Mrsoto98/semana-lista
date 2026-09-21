import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const g = (a: number) => `rgba(var(--glow), ${a})`

/* ─── Step visuals ─────────────────────────────────────────────── */

function WelcomeVisual() {
  const items = [
    { icon: '📖', a: 0 }, { icon: '✨', a: 60 }, { icon: '🌊', a: 120 },
    { icon: '📊', a: 180 }, { icon: '🎨', a: 240 }, { icon: '🔔', a: 300 },
  ]
  return (
    <div className="relative flex items-center justify-center" style={{ height: 128 }}>
      <div className="absolute w-28 h-28 rounded-full" style={{ border: `1px solid ${g(0.18)}`, animation: 'tutRotate 14s linear infinite' }} />
      <div className="absolute w-20 h-20 rounded-full" style={{ border: `1px dashed ${g(0.1)}` }} />
      <div className="text-5xl z-10" style={{ filter: `drop-shadow(0 0 22px ${g(0.9)})`, animation: 'tutFloat 3.5s ease-in-out infinite' }}>☽</div>
      {items.map(({ icon, a }, i) => {
        const rad = (a * Math.PI) / 180
        const x = Math.cos(rad) * 56, y = Math.sin(rad) * 56
        return (
          <div key={icon} className="absolute flex items-center justify-center rounded-[10px] text-lg"
            style={{
              width: 30, height: 30,
              left: `calc(50% + ${x}px - 15px)`, top: `calc(50% + ${y}px - 15px)`,
              background: g(0.13), border: `1px solid ${g(0.26)}`,
              animation: `tutFadeUp 0.4s ${i * 0.07}s ease both`,
            }}>
            {icon}
          </div>
        )
      })}
    </div>
  )
}

function DiaryVisual() {
  const [menuVisible, setMenuVisible] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setMenuVisible(true), 900)
    const t2 = setTimeout(() => setMenuVisible(false), 2600)
    const t3 = setTimeout(() => setMenuVisible(true), 4000)
    const t4 = setTimeout(() => setMenuVisible(false), 5700)
    return () => [t1, t2, t3, t4].forEach(clearTimeout)
  }, [])
  return (
    <div className="relative" style={{ height: 128 }}>
      {/* Dream card */}
      <div className="rounded-[18px] p-3.5 mx-2" style={{ background: g(0.08), border: `1px solid ${g(0.2)}` }}>
        <div className="flex items-start gap-2.5">
          <div className="rounded-xl px-2 py-1.5 shrink-0 text-center" style={{ background: g(0.1), minWidth: 42 }}>
            <div className="text-[9px] text-white/40">LUN</div>
            <div className="text-lg font-bold leading-none text-white/90">21</div>
            <div className="text-[9px] text-white/40">sep</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white/85 leading-snug">Vuelo sobre el mar ✨</p>
            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed line-clamp-2">
              Sobrevolaba el océano al atardecer, sentía el viento…
            </p>
            <div className="flex gap-1 mt-1.5">
              {['paz', 'asombro'].map(e => (
                <span key={e} className="text-[9px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: g(0.1), color: 'rgba(255,255,255,0.5)' }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
        {/* Long-press hint finger */}
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5"
          style={{ animation: menuVisible ? 'none' : 'tutFingerTap 0.9s 0.2s ease-in-out both' }}>
          <span className="text-[11px] text-white/20" style={{ fontFamily: 'var(--font-mono)' }}>mantén</span>
          <span className="text-base" style={{ animation: 'tutFloat 1.8s ease-in-out infinite' }}>👆</span>
        </div>
      </div>
      {/* Context menu */}
      <AnimatePresence>
        {menuVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute left-3 right-3 rounded-[16px] overflow-hidden z-10"
            style={{ bottom: -4, background: 'rgba(12,14,28,0.98)', border: `1px solid ${g(0.25)}`, boxShadow: `0 16px 40px rgba(0,0,0,0.6)` }}
          >
            {[['✏️', 'Editar sueño'], ['✨', 'Marcar lúcido'], ['↗️', 'Compartir tarjeta'], ['🗑️', 'Eliminar']].map(([ic, lbl], i) => (
              <div key={lbl} className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-white/70"
                style={{ borderBottom: i < 3 ? `1px solid rgba(255,255,255,0.05)` : 'none', animation: `tutFadeUp 0.2s ${i * 0.04}s ease both` }}>
                <span>{ic}</span><span>{lbl}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NewDreamVisual() {
  const [micActive, setMicActive] = useState(false)
  const [activeEmo, setActiveEmo] = useState<string[]>([])
  const emotions = ['paz', 'alegría', 'asombro', 'miedo', 'amor']
  useEffect(() => {
    const t1 = setTimeout(() => setMicActive(true), 800)
    const t2 = setTimeout(() => setMicActive(false), 2200)
    const t3 = setTimeout(() => setActiveEmo(['paz', 'asombro']), 2800)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [])
  return (
    <div className="space-y-2.5 mx-2" style={{ height: 128 }}>
      {/* Input mockup */}
      <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: g(0.07), border: `1px solid ${g(0.15)}` }}>
        <span className="text-[13px] text-white/30 flex-1">Escribe o habla tu sueño…</span>
        <motion.div
          animate={micActive ? { scale: [1, 1.18, 1.08], background: [g(0.15), g(0.45), g(0.35)] } : { scale: 1 }}
          transition={micActive ? { duration: 0.5, repeat: 2 } : {}}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: micActive ? g(0.35) : g(0.1), border: `1px solid ${g(micActive ? 0.6 : 0.2)}`, boxShadow: micActive ? `0 0 12px ${g(0.5)}` : 'none' }}
        >
          <span className="text-sm">🎙️</span>
        </motion.div>
      </div>
      {/* Emotions */}
      <div className="flex gap-1.5 flex-wrap">
        {emotions.map(e => (
          <motion.span key={e}
            animate={activeEmo.includes(e) ? { scale: 1.05 } : { scale: 1 }}
            className="text-[10px] px-2.5 py-1 rounded-full cursor-pointer capitalize transition-all"
            style={{
              background: activeEmo.includes(e) ? g(0.22) : g(0.07),
              border: `1px solid ${g(activeEmo.includes(e) ? 0.4 : 0.12)}`,
              color: activeEmo.includes(e) ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.45)',
            }}>
            {e}
          </motion.span>
        ))}
      </div>
      {/* Lucid toggle */}
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl" style={{ background: g(0.05), border: `1px solid ${g(0.1)}` }}>
        <span className="text-[12px] text-white/60">¿Fue lúcido?</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-white/30">Sueño consciente</span>
          <span className="text-base" style={{ animation: 'tutFloat 2s ease-in-out infinite' }}>✨</span>
        </div>
      </div>
    </div>
  )
}

function LucidVisual() {
  return (
    <div className="flex gap-3 mx-2" style={{ height: 128, alignItems: 'center' }}>
      {/* Normal dream */}
      <div className="flex-1 rounded-[16px] p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-white/50 font-medium">Normal</span>
          <span className="text-[9px] text-white/20 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>🔒</span>
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed">El bosque se extendía sin fin en la niebla…</p>
        <div className="flex gap-1 mt-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white/30" style={{ background: 'rgba(255,255,255,0.05)' }}>miedo</span>
        </div>
      </div>
      {/* Arrow */}
      <div className="text-white/20 text-lg shrink-0">→</div>
      {/* Lucid dream */}
      <div className="flex-1 rounded-[16px] p-3 relative overflow-hidden"
        style={{
          background: 'rgba(100,212,184,0.07)',
          border: '1.5px solid rgba(100,212,184,0.5)',
          boxShadow: '0 0 20px rgba(100,212,184,0.12), -2px 0 12px rgba(100,212,184,0.06)',
        }}>
        <div className="absolute top-0 right-0 w-12 h-12 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #64D4B8, transparent)', transform: 'translate(30%,-30%)' }} />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold" style={{ color: '#64D4B8' }}>Lúcido</span>
          <div className="w-4 h-4 rounded-full shrink-0" style={{ background: 'rgba(100,212,184,0.3)', border: '1px solid rgba(100,212,184,0.6)', animation: 'tutPulse 2s ease-in-out infinite' }} />
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed">El bosque — y supe que era un sueño…</p>
        <div className="flex items-center gap-1 mt-2">
          <span className="text-[11px]">✨</span>
          <span className="text-[9px] font-bold" style={{ color: '#64D4B8' }}>Consciente</span>
        </div>
      </div>
    </div>
  )
}

function WhisperVisual() {
  const [count, setCount] = useState(12)
  const [resonated, setResonated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => { setResonated(true); setCount(13) }, 1600)
    const t2 = setTimeout(() => { setResonated(false); setCount(12) }, 3400)
    const t3 = setTimeout(() => { setResonated(true); setCount(13) }, 5000)
    return () => [t, t2, t3].forEach(clearTimeout)
  }, [])
  return (
    <div className="mx-2 rounded-[18px] p-4 relative overflow-hidden" style={{ height: 128, background: 'rgba(184,164,232,0.07)', border: '1px solid rgba(184,164,232,0.2)' }}>
      <div className="absolute top-3 left-3 text-4xl leading-none opacity-10 select-none" style={{ fontFamily: 'var(--font-serif)', color: '#B8A4E8' }}>"</div>
      <p className="text-[13px] text-white/75 leading-relaxed mb-3 relative z-10" style={{ fontFamily: 'var(--font-serif)' }}>
        Había una puerta que nunca había visto antes, y detrás…
      </p>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex gap-1.5">
          {['asombro', 'misterio'].map(e => (
            <span key={e} className="text-[9px] px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(184,164,232,0.15)', color: 'rgba(184,164,232,0.9)' }}>{e}</span>
          ))}
        </div>
        <motion.button
          animate={resonated ? { scale: [1, 1.3, 1.1] } : { scale: 1 }}
          transition={resonated ? { duration: 0.4, type: 'spring', stiffness: 400 } : {}}
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: resonated ? '#B8A4E8' : 'rgba(255,255,255,0.35)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={resonated ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <motion.span key={count} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{count}</motion.span>
          {resonated ? 'resoñado' : 'resoñar'}
        </motion.button>
      </div>
    </div>
  )
}

function ProfileVisual() {
  const [streak, setStreak] = useState(0)
  useEffect(() => {
    let i = 0
    const iv = setInterval(() => {
      i++; setStreak(i)
      if (i >= 14) clearInterval(iv)
    }, 60)
    return () => clearInterval(iv)
  }, [])
  const days = Array.from({ length: 35 }, (_, i) => ({
    active: [1,2,3,5,6,8,9,10,11,13,14,15,16,17,19,20,22,23,24,27,28,29,30,31,32,33,34].includes(i),
    today: i === 34,
  }))
  return (
    <div className="mx-2 space-y-2.5" style={{ height: 128 }}>
      {/* Streak + heatmap row */}
      <div className="flex gap-2.5 items-center">
        {/* Streak */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0"
          style={{ background: g(0.1), border: `1px solid ${g(0.22)}` }}>
          <span className="text-lg">🔥</span>
          <div>
            <motion.p key={streak} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="text-lg font-bold leading-none" style={{ color: `hsl(var(--accent-h), var(--accent-s), 76%)`, fontFamily: 'var(--font-mono)' }}>
              {streak}
            </motion.p>
            <p className="text-[9px] text-white/30 leading-none mt-0.5">días</p>
          </div>
        </div>
        {/* Mini heatmap */}
        <div className="flex-1 flex flex-wrap gap-[2px]">
          {days.map((d, i) => (
            <div key={i} className="rounded-[3px]"
              style={{
                width: 10, height: 10,
                background: d.today ? `hsl(var(--accent-h), var(--accent-s), 72%)` : d.active ? g(d.today ? 0.9 : 0.45) : 'rgba(255,255,255,0.06)',
                animation: d.active ? `tutFadeUp 0.3s ${i * 0.01}s ease both` : 'none',
              }} />
          ))}
        </div>
      </div>
      {/* Recurring symbols */}
      <div className="space-y-1">
        <p className="text-[9px] text-white/25 uppercase tracking-wider">Símbolos recurrentes</p>
        {[{ word: 'agua', pct: 100 }, { word: 'vuelo', pct: 78 }, { word: 'puerta', pct: 55 }].map(({ word, pct }) => (
          <div key={word} className="flex items-center gap-2">
            <span className="text-[10px] text-white/45 w-12 shrink-0">{word}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g(0.6), animation: 'tutWidth 1s 0.5s ease both' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShareThemeVisual() {
  const [activeTheme, setActiveTheme] = useState(0)
  const themes = [
    { label: 'Cosmos', h: '258', s: '60%', rgb: '140,120,220' },
    { label: 'Abismo', h: '214', s: '65%', rgb: '80,150,220' },
    { label: 'Selva',  h: '152', s: '55%', rgb: '60,185,120' },
    { label: 'Pétalo', h: '328', s: '55%', rgb: '220,100,170' },
  ]
  useEffect(() => {
    const iv = setInterval(() => setActiveTheme(t => (t + 1) % 4), 1200)
    return () => clearInterval(iv)
  }, [])
  return (
    <div className="mx-2 space-y-3" style={{ height: 128 }}>
      {/* Share card preview */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl p-3 flex-1"
          style={{ background: `rgba(${themes[activeTheme].rgb},0.1)`, border: `1px solid rgba(${themes[activeTheme].rgb},0.3)`, transition: 'all 0.5s ease' }}>
          <p className="text-[11px] font-medium text-white/80 mb-1" style={{ fontFamily: 'var(--font-serif)' }}>Vuelo sobre el mar</p>
          <p className="text-[10px] text-white/40">Sobrevolaba el océano…</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white/50" style={{ background: `rgba(${themes[activeTheme].rgb},0.2)` }}>paz</span>
            <span className="text-[9px] text-white/25">↗ Compartir</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {themes.map((t, i) => (
            <motion.div key={t.label}
              animate={{ scale: activeTheme === i ? 1.15 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="w-6 h-6 rounded-full"
              style={{
                background: `hsl(${t.h}, ${t.s}, 60%)`,
                border: activeTheme === i ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                boxShadow: activeTheme === i ? `0 0 10px hsl(${t.h}, ${t.s}, 55%)` : 'none',
              }} />
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 justify-center">
        {['🎨 4 temas', '📔 8 fondos', '🔔 Recordatorio'].map(chip => (
          <span key={chip} className="text-[9px] px-2 py-1 rounded-full text-white/45"
            style={{ background: g(0.07), border: `1px solid ${g(0.15)}` }}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}

function FinalVisual() {
  const stars = Array.from({ length: 18 }, (_, i) => ({
    x: 10 + (i * 37 + i * i * 13) % 80,
    y: 5 + (i * 53 + i * 7) % 90,
    size: 0.8 + (i % 3) * 0.5,
    delay: i * 0.12,
  }))
  return (
    <div className="relative flex items-center justify-center" style={{ height: 128 }}>
      {stars.map((s, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: `${s.size * 3}px`, height: `${s.size * 3}px`,
            background: `rgba(var(--glow), 0.7)`,
            animation: `tutTwinkle ${1.5 + s.delay}s ${s.delay}s ease-in-out infinite`,
          }} />
      ))}
      <div className="flex flex-col items-center gap-3 z-10">
        <div className="text-5xl" style={{ filter: `drop-shadow(0 0 24px ${g(0.8)})`, animation: 'tutFloat 3s ease-in-out infinite' }}>🌙</div>
        <div className="flex gap-2">
          {['Registra', 'Descubre', 'Comparte'].map((w, i) => (
            <span key={w} className="text-[11px] px-2.5 py-1 rounded-full text-white/70"
              style={{ background: g(0.1), border: `1px solid ${g(0.25)}`, animation: `tutFadeUp 0.4s ${i * 0.12}s ease both` }}>
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Step data ─────────────────────────────────────────────────── */

const STEPS = [
  {
    icon: '☽',
    title: 'Bienvenido a\nBitácora del Sueño',
    sub: 'Tu diario onírico personal',
    body: 'Registra tus sueños cada mañana, analiza tus patrones, comparte con amigos y entrena la lucidez. Todo en un solo lugar.',
    Visual: WelcomeVisual,
  },
  {
    icon: '📖',
    title: 'Tu Diario',
    sub: 'Cada sueño en su lugar',
    body: 'Tus sueños se agrupan por semana. Mantén pulsada una tarjeta para ver el menú: editar, compartir, marcar lúcido o eliminar. Desliza hacia abajo para refrescar.',
    Visual: DiaryVisual,
  },
  {
    icon: '✍️',
    title: 'Anota al despertar',
    sub: 'Antes de que se desvanezca',
    body: 'Escribe el título y el sueño con detalle. Pulsa el micrófono para dictar con tu voz — más rápido que escribir. Elige emociones y etiquetas para encontrarlos después.',
    Visual: NewDreamVisual,
  },
  {
    icon: '✨',
    title: 'Sueños Lúcidos',
    sub: 'Cuando sabes que estás soñando',
    body: 'Activa el marcador de lúcido al registrar un sueño o desde el menú de la tarjeta. Tienen borde especial y sus propias estadísticas en tu perfil.',
    Visual: LucidVisual,
  },
  {
    icon: '🌊',
    title: 'Susurros',
    sub: 'Sueños anónimos, emociones reales',
    body: 'Comparte fragmentos de sueños de forma completamente anónima. Ponles título, elige emociones y descubre qué resuena en otros soñadores.',
    Visual: WhisperVisual,
  },
  {
    icon: '📊',
    title: 'Tu Perfil',
    sub: 'Conoce tus patrones oníricos',
    body: 'Sigue tu racha de sueños consecutivos, visualiza qué días soñas más con el mapa de calor y descubre los símbolos que más aparecen en tus sueños.',
    Visual: ProfileVisual,
  },
  {
    icon: '🎨',
    title: 'Comparte y personaliza',
    sub: 'Hazla completamente tuya',
    body: 'Genera tarjetas de sueño para Stories con mantener pulsado → Compartir. Elige entre 4 temas de color y 8 fondos de bitácora. Activa el recordatorio diario para no olvidar.',
    Visual: ShareThemeVisual,
  },
  {
    icon: '🌙',
    title: '¡Todo listo!',
    sub: 'El universo onírico te espera',
    body: 'Esta noche, antes de dormir, pon el teléfono cerca. Al despertar, abre la app y anota lo que recuerdes — aunque sean solo fragmentos. Tu bitácora empieza esta noche.',
    Visual: FinalVisual,
  },
]

/* ─── Main component ────────────────────────────────────────────── */

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 36 : -36 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir: number) => ({ opacity: 0, x: dir > 0 ? -36 : 36 }),
}

interface Props { open: boolean; onClose: () => void }

export function TutorialOverlay({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const touchStartX = useRef(0)
  const isLast = step === STEPS.length - 1

  useEffect(() => { if (open) { setStep(0); setDir(1) } }, [open])

  const goNext = useCallback(() => {
    if (isLast) { close(); return }
    setDir(1); setStep(s => s + 1)
    navigator.vibrate?.(8)
  }, [isLast])

  const goPrev = useCallback(() => {
    if (step === 0) return
    setDir(-1); setStep(s => s - 1)
    navigator.vibrate?.(6)
  }, [step])

  function close() {
    localStorage.setItem('tutorial-seen', '1')
    navigator.vibrate?.([8, 40, 8])
    onClose()
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 48) return
    if (dx < 0) goNext(); else goPrev()
  }

  if (!open) return null

  const current = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
        style={{ background: 'rgba(2,4,18,0.90)', backdropFilter: 'blur(20px)' }}
        onClick={close}
      />

      {/* Ambient glow */}
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${g(0.12)} 0%, transparent 70%)`, filter: 'blur(60px)' }}
        />
      </div>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[102] h-[3px]" style={{ background: g(0.1) }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 180, damping: 28 }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${g(0.55)}, ${g(1)})`, boxShadow: `0 0 10px ${g(0.7)}` }}
        />
      </div>

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '110%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="fixed inset-x-0 bottom-0 z-[101] px-4"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-w-lg mx-auto rounded-[28px] overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, rgba(8,12,32,0.98) 0%, rgba(3,5,18,0.99) 100%)',
            border: `1px solid ${g(0.28)}`,
            boxShadow: `0 -8px 48px ${g(0.12)}, 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 ${g(0.1)}`,
          }}>

          {/* Top handle + controls */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: g(0.22) }} />
            <div className="flex items-center gap-3">
              {/* Step pills */}
              <div className="flex items-center gap-1">
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => { setDir(i > step ? 1 : -1); setStep(i) }}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === step ? 18 : 5, height: 5,
                      background: i === step ? g(0.9) : i < step ? g(0.35) : 'rgba(255,255,255,0.12)',
                      boxShadow: i === step ? `0 0 8px ${g(0.6)}` : 'none',
                    }} />
                ))}
              </div>
              <span className="text-[11px] font-medium" style={{ color: g(0.55) }}>{step + 1}/{STEPS.length}</span>
              <button onClick={close}
                className="text-[11px] text-white/25 hover:text-white/55 transition-colors px-2 py-1 rounded-lg"
                style={{ border: `1px solid rgba(255,255,255,0.07)` }}>
                Saltar
              </button>
            </div>
          </div>

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
              className="px-5 pt-4 pb-3"
            >
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <span className="text-5xl block" style={{ filter: `drop-shadow(0 0 20px ${g(0.6)})`, animation: 'tutFloat 3.5s ease-in-out infinite' }}>
                  {current.icon}
                </span>
              </div>

              {/* Visual */}
              <div className="mb-5 overflow-hidden">
                <current.Visual />
              </div>

              {/* Text */}
              <h2 className="text-xl font-bold text-white text-center leading-tight mb-1 whitespace-pre-line">
                {current.title}
              </h2>
              <p className="text-[12px] font-semibold text-center mb-2.5" style={{ color: g(0.85) }}>
                {current.sub}
              </p>
              <p className="text-[13px] text-white/50 text-center leading-relaxed">
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="px-5 pb-6 flex gap-3 mt-1">
            {step > 0 && (
              <button onClick={goPrev}
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.09)` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            )}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={goNext}
              className="flex-1 py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-shadow"
              style={{
                background: isLast
                  ? `linear-gradient(135deg, ${g(0.9)}, ${g(0.6)})`
                  : `linear-gradient(135deg, ${g(0.85)}, ${g(0.6)})`,
                color: '#001220',
                boxShadow: `0 4px 24px ${g(0.32)}, inset 0 1px 0 rgba(255,255,255,0.22)`,
              }}>
              {isLast
                ? <><span>¡Empezar a soñar!</span><span style={{ filter: `drop-shadow(0 0 8px ${g(1)})` }}>🌙</span></>
                : <><span>Siguiente</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg></>
              }
            </motion.button>
          </div>

        </div>
      </motion.div>

      <style>{`
        @keyframes tutFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes tutRotate   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes tutFadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tutPulse    { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
        @keyframes tutTwinkle  { 0%,100%{opacity:0.15;transform:scale(0.7)} 50%{opacity:0.9;transform:scale(1.2)} }
        @keyframes tutFingerTap{ 0%{transform:scale(1)} 50%{transform:scale(0.88)} 100%{transform:scale(1)} }
        @keyframes tutWidth    { from{width:0} }
      `}</style>
    </>
  )
}
