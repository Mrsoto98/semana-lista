import { useState, useEffect, useRef, useCallback, type ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const g = (a: number) => `rgba(var(--glow), ${a})`

/* ─── Visuals ─────────────────────────────────────────────────── */

function WelcomeVisual() {
  const items = [
    { icon: '📖', a: 0 }, { icon: '✨', a: 60 }, { icon: '🌊', a: 120 },
    { icon: '📊', a: 180 }, { icon: '🎨', a: 240 }, { icon: '🔔', a: 300 },
  ]
  return (
    <div className="relative flex items-center justify-center" style={{ height: 110 }}>
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

function ExploreVisual() {
  const [activeTab, setActiveTab] = useState(0)
  const tabs = ['Recientes', '🔥 Popular', 'Seguidos']
  useEffect(() => {
    const iv = setInterval(() => setActiveTab(t => (t + 1) % 3), 1600)
    return () => clearInterval(iv)
  }, [])
  const cards = [
    { init: 'L', name: 'Luna', time: '2h', txt: 'Corría por un laberinto de espejos infinitos…', likes: 8 },
    { init: 'A', name: 'Astro', time: '5h', txt: 'Vi una ciudad flotante entre las nubes…', likes: 23 },
  ]
  return (
    <div className="mx-2 space-y-2" style={{ height: 110 }}>
      <div className="flex gap-1.5">
        {tabs.map((tab, i) => (
          <motion.div key={tab}
            animate={{
              background: activeTab === i ? g(0.2) : g(0.05),
              borderColor: activeTab === i ? g(0.32) : g(0.1),
            }}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium border"
            style={{ color: activeTab === i ? `hsl(var(--accent-h),var(--accent-s),80%)` : 'rgba(255,255,255,0.3)' }}>
            {tab}
          </motion.div>
        ))}
      </div>
      <div className="space-y-1.5">
        {cards.map((c, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2"
            style={{ background: g(0.06), border: `1px solid ${g(0.12)}` }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: g(0.2), color: `hsl(var(--accent-h),var(--accent-s),78%)` }}>
              {c.init}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-white/70">{c.name}</span>
                <span className="text-[9px] text-white/25 shrink-0">{c.time}</span>
              </div>
              <p className="text-[10px] text-white/40 leading-tight truncate">{c.txt}</p>
            </div>
            <div className="text-[9px] text-white/25 shrink-0">♡ {c.likes}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function WhisperVisual() {
  const [count, setCount] = useState(12)
  const [resonated, setResonated] = useState(false)
  useEffect(() => {
    const t  = setTimeout(() => { setResonated(true);  setCount(13) }, 1600)
    const t2 = setTimeout(() => { setResonated(false); setCount(12) }, 3400)
    const t3 = setTimeout(() => { setResonated(true);  setCount(13) }, 5000)
    return () => [t, t2, t3].forEach(clearTimeout)
  }, [])
  return (
    <div className="mx-2 rounded-[18px] p-4 relative overflow-hidden"
      style={{ height: 110, background: 'rgba(184,164,232,0.07)', border: '1px solid rgba(184,164,232,0.2)' }}>
      <div className="absolute top-3 left-3 text-4xl leading-none opacity-10 select-none"
        style={{ fontFamily: 'var(--font-serif)', color: '#B8A4E8' }}>"</div>
      <p className="text-[13px] text-white/75 leading-relaxed mb-3 relative z-10"
        style={{ fontFamily: 'var(--font-serif)' }}>
        Había una puerta que nunca había visto antes, y detrás…
      </p>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex gap-1.5">
          {['asombro', 'misterio'].map(e => (
            <span key={e} className="text-[9px] px-2 py-0.5 rounded-full capitalize"
              style={{ background: 'rgba(184,164,232,0.15)', color: 'rgba(184,164,232,0.9)' }}>{e}</span>
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

function MessagesVisual() {
  const [step1, setStep1] = useState(false)
  const [step2, setStep2] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setStep1(true), 700)
    const t2 = setTimeout(() => setStep2(true), 1700)
    const t3 = setTimeout(() => { setStep1(false); setStep2(false) }, 4200)
    const t4 = setTimeout(() => setStep1(true), 4700)
    const t5 = setTimeout(() => setStep2(true), 5700)
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, [])
  return (
    <div className="mx-2 space-y-2.5" style={{ height: 110 }}>
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
        style={{ background: g(0.07), border: `1px solid ${g(0.18)}` }}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0"
          style={{ background: g(0.22), border: `1px solid ${g(0.4)}`, boxShadow: `0 0 8px ${g(0.3)}` }}>
          ✦
        </div>
        <p className="text-[11px] text-white/55">
          Coincidencia con <span className="text-white/80 font-medium">Luna</span> aceptada ✓
        </p>
      </div>
      <AnimatePresence>
        {step1 && (
          <motion.div
            initial={{ opacity: 0, x: -10, y: 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            className="flex items-end gap-2"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: g(0.18), color: `hsl(var(--accent-h),var(--accent-s),76%)` }}>
              L
            </div>
            <div className="px-3 py-2 rounded-[14px] rounded-bl-[4px] text-[11px] text-white/70"
              style={{ background: g(0.1), border: `1px solid ${g(0.2)}`, maxWidth: 170 }}>
              ¿También soñaste que volabas?
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {step2 && (
          <motion.div
            initial={{ opacity: 0, x: 10, y: 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            className="flex justify-end"
          >
            <div className="px-3 py-2 rounded-[14px] rounded-br-[4px] text-[11px] text-white/80"
              style={{ background: g(0.22), border: `1px solid ${g(0.38)}`, maxWidth: 170 }}>
              ¡Sí! Sobre montañas nevadas ✦
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="mx-2 space-y-2.5" style={{ height: 110 }}>
      <div className="flex gap-2.5 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0"
          style={{ background: g(0.1), border: `1px solid ${g(0.22)}` }}>
          <span className="text-lg">🔥</span>
          <div>
            <motion.p key={streak} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="text-lg font-bold leading-none"
              style={{ color: `hsl(var(--accent-h), var(--accent-s), 76%)`, fontFamily: 'var(--font-mono)' }}>
              {streak}
            </motion.p>
            <p className="text-[9px] text-white/30 leading-none mt-0.5">días</p>
          </div>
        </div>
        <div className="flex-1 flex flex-wrap gap-[2px]">
          {days.map((d, i) => (
            <div key={i} className="rounded-[3px]"
              style={{
                width: 10, height: 10,
                background: d.today
                  ? `hsl(var(--accent-h), var(--accent-s), 72%)`
                  : d.active ? g(0.45) : 'rgba(255,255,255,0.06)',
                animation: d.active ? `tutFadeUp 0.3s ${i * 0.01}s ease both` : 'none',
              }} />
          ))}
        </div>
      </div>
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

function FinalVisual() {
  const stars = Array.from({ length: 18 }, (_, i) => ({
    x: 10 + (i * 37 + i * i * 13) % 80,
    y: 5 + (i * 53 + i * 7) % 90,
    size: 0.8 + (i % 3) * 0.5,
    delay: i * 0.12,
  }))
  return (
    <div className="relative flex items-center justify-center" style={{ height: 110 }}>
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
          {['Registra', 'Descubre', 'Conecta'].map((w, i) => (
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

/* ─── Nav selector icons (mirrors BottomNav) ────────────────────── */

const NAV_SELECTOR = [
  {
    label: 'Susurros', stepIdx: 2,
    Icon: ({ active }: { active: boolean }) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    ),
  },
  {
    label: 'Explorar', stepIdx: 1,
    Icon: ({ active }: { active: boolean }) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon fill={active ? 'currentColor' : 'none'} points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
      </svg>
    ),
  },
  {
    label: 'Mensajes', stepIdx: 3,
    Icon: ({ active }: { active: boolean }) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: 'Perfil', stepIdx: 4,
    Icon: ({ active }: { active: boolean }) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4" fill={active ? 'currentColor' : 'none'}/>
      </svg>
    ),
  },
]

/* ─── Step data ─────────────────────────────────────────────────── */

interface TutStep {
  type: 'welcome' | 'nav' | 'finish'
  icon: string
  title: string
  sub: string
  body: string
  Visual: ComponentType
}

const STEPS: TutStep[] = [
  {
    type: 'welcome',
    icon: '☽',
    title: 'Bienvenido a\nmyDreams',
    sub: 'Tu diario onírico personal',
    body: 'Registra tus sueños cada mañana, descubre tus patrones y conecta con personas que sueñan como tú.',
    Visual: WelcomeVisual,
  },
  {
    type: 'nav',
    icon: '🔭',
    title: 'Explorar',
    sub: 'El universo onírico colectivo',
    body: 'Sueños de toda la comunidad — los más recientes, los más populares, los de personas que sigues. Lee, da likes y comenta.',
    Visual: ExploreVisual,
  },
  {
    type: 'nav',
    icon: '🌙',
    title: 'Susurros',
    sub: 'Anónimo. Colectivo. Resonante.',
    body: 'Fragmentos de sueños sin identidad. Tú publicas, otros resuenan — y puedes descubrir quién soñó algo parecido.',
    Visual: WhisperVisual,
  },
  {
    type: 'nav',
    icon: '💬',
    title: 'Mensajes',
    sub: 'Conexiones reales, nacidas de sueños',
    body: 'Cuando tú y otro soñador aceptáis una coincidencia, aquí nace vuestra conversación privada.',
    Visual: MessagesVisual,
  },
  {
    type: 'nav',
    icon: '✦',
    title: 'Perfil',
    sub: 'Conoce tus patrones oníricos',
    body: 'Racha de días, mapa de calor, símbolos recurrentes. Cuanto más registras, más fascinante se vuelve tu perfil.',
    Visual: ProfileVisual,
  },
  {
    type: 'finish',
    icon: '🌙',
    title: '¡Todo listo!',
    sub: 'Esta noche empieza todo',
    body: 'Pon el teléfono cerca antes de dormir. Al despertar, abre la app y anota lo que recuerdes — aunque sean solo fragmentos.',
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
  const [step, setStep]   = useState(0)
  const [dir, setDir]     = useState(1)
  const touchStartX       = useRef(0)
  const isLast            = step === STEPS.length - 1

  useEffect(() => { if (open) { setStep(0); setDir(1) } }, [open])

  const close = useCallback(() => {
    localStorage.setItem('tutorial-seen', '1')
    navigator.vibrate?.([8, 40, 8])
    onClose()
  }, [onClose])

  const goNext = useCallback(() => {
    if (isLast) { close(); return }
    setDir(1); setStep(s => s + 1)
    navigator.vibrate?.(8)
  }, [isLast, close])

  const goPrev = useCallback(() => {
    if (step === 0) return
    setDir(-1); setStep(s => s - 1)
    navigator.vibrate?.(6)
  }, [step])

  const jumpTo = useCallback((target: number) => {
    setDir(target > step ? 1 : -1)
    setStep(target)
    navigator.vibrate?.(8)
  }, [step])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 48) return
    if (dx < 0) goNext(); else goPrev()
  }

  if (!open) return null

  const current  = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100
  const isNavStep = current.type === 'nav'

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
              <div className="flex items-center gap-1">
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => jumpTo(i)}
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
              className="px-5 pt-3 pb-3"
            >
              {/* Interactive nav selector — only for nav steps */}
              {isNavStep && (
                <div className="flex justify-center gap-2 mb-4">
                  {NAV_SELECTOR.map(({ label, stepIdx, Icon }) => {
                    const isActive = stepIdx === step
                    return (
                      <motion.button
                        key={label}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => jumpTo(stepIdx)}
                        className="flex flex-col items-center gap-1 px-3 py-2 rounded-[18px] transition-colors"
                        style={{
                          background: isActive ? g(0.22) : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isActive ? g(0.42) : 'rgba(255,255,255,0.07)'}`,
                          boxShadow: isActive ? `0 0 16px ${g(0.22)}` : 'none',
                          color: isActive
                            ? `hsl(var(--accent-h),var(--accent-s),80%)`
                            : 'rgba(255,255,255,0.3)',
                          transform: isActive ? 'scale(1.06)' : 'scale(1)',
                          transition: 'transform 0.2s, background 0.2s, border-color 0.2s',
                        }}
                      >
                        <Icon active={isActive} />
                        <span className="text-[9px] font-medium leading-none">{label}</span>
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Icon (only on non-nav steps) */}
              {!isNavStep && (
                <div className="flex justify-center mb-4">
                  <span className="text-5xl block"
                    style={{ filter: `drop-shadow(0 0 20px ${g(0.6)})`, animation: 'tutFloat 3.5s ease-in-out infinite' }}>
                    {current.icon}
                  </span>
                </div>
              )}

              {/* Visual */}
              <div className="mb-4 overflow-hidden">
                <current.Visual />
              </div>

              {/* Text */}
              <h2 className="text-xl font-bold text-white text-center leading-tight mb-1 whitespace-pre-line">
                {current.title}
              </h2>
              <p className="text-[12px] font-semibold text-center mb-2" style={{ color: g(0.85) }}>
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
              className="flex-1 py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${g(0.85)}, ${g(0.6)})`,
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
        @keyframes tutWidth    { from{width:0} }
      `}</style>
    </>
  )
}
