import { useState, useEffect, useCallback } from 'react'

const C = '0,194,255'   // celeste RGB
const c = (a: number) => `rgba(${C},${a})`

const STEPS = [
  {
    emoji: '🌙',
    title: 'Bienvenido a\nBitácora del Sueño',
    subtitle: 'Tu diario onírico personal',
    body: 'Registra tus sueños cada mañana, conecta con amigos, descubre coincidencias y entrena la lucidez. Todo en un solo lugar.',
    visual: <IntroVisual />,
  },
  {
    emoji: '📖',
    title: 'Tu Diario',
    subtitle: 'Registra cada sueño al despertar',
    body: 'Añade título, descripción y etiquetas. Marca si fue lúcido para llevar seguimiento especial. Se guardan en orden cronológico.',
    visual: <DiaryVisual />,
  },
  {
    emoji: '🔥',
    title: 'Racha de sueños',
    subtitle: 'Construye el hábito',
    body: 'Cada día que registras un sueño suma a tu racha. Cuantos más días consecutivos, más vívidos se vuelven tus sueños.',
    visual: <StreakVisual />,
  },
  {
    emoji: '👥',
    title: 'Feed Social',
    subtitle: 'Comparte el mundo onírico',
    body: 'Ve los sueños que tus amigos comparten. Dale like, comenta y descubre mundos imaginarios que nunca esperarías.',
    visual: <FeedVisual />,
  },
  {
    emoji: '✨',
    title: 'Coincidencias',
    subtitle: 'La magia de soñar juntos',
    body: 'Cuando tú y un amigo soñáis con los mismos elementos — agua, vuelo, laberintos — la app lo detecta automáticamente.',
    visual: <CoincidenceVisual />,
  },
  {
    emoji: '🎙️',
    title: 'Monitor de audio',
    subtitle: 'Captura sueños al despertar',
    body: 'Actívalo antes de dormir. Al despertar graba tu sueño en voz antes de que se desvanezca — más rápido que escribir.',
    visual: <MonitorVisual />,
  },
  {
    emoji: '🎨',
    title: 'Compartir como imagen',
    subtitle: '5 plantillas para Stories',
    body: 'Transforma cualquier sueño en una imagen preciosa 1080×1920 lista para Instagram Stories o WhatsApp con un solo toque.',
    visual: <ShareVisual />,
  },
  {
    emoji: '🚀',
    title: '¡Todo listo!',
    subtitle: 'El universo onírico te espera',
    body: 'Empieza esta noche. Mañana al despertar, abre la app y registra lo que recuerdes — aunque sean solo fragmentos.',
    visual: <FinalVisual />,
  },
]

/* ── Mini visuals ──────────────────────────────────────────────── */

function IntroVisual() {
  const icons = ['📖', '✨', '👥', '🎙️', '🎨', '⚙️']
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      {icons.map((e, i) => (
        <div key={e} className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
          style={{
            background: c(0.1), border: `1px solid ${c(0.2)}`,
            animation: `fadeInUp 0.4s ${i * 0.07}s ease both`,
          }}>
          {e}
        </div>
      ))}
    </div>
  )
}

function DiaryVisual() {
  return (
    <div className="rounded-2xl p-3 text-left space-y-2" style={{ background: c(0.07), border: `1px solid ${c(0.18)}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: c(0.9) }} />
          <span className="text-xs font-semibold text-white/80">Vuelo sobre el mar</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: c(0.15), color: c(1), border: `1px solid ${c(0.35)}` }}>
          ✦ Lúcido
        </span>
      </div>
      <p className="text-[11px] text-white/45 leading-relaxed">Volaba sobre el océano al atardecer, podía sentir el viento en la cara…</p>
      <div className="flex gap-1.5">
        {['vuelo', 'mar', 'paz'].map(t => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full text-white/40" style={{ background: c(0.08) }}>#{t}</span>
        ))}
      </div>
    </div>
  )
}

function StreakVisual() {
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl" style={{ background: c(0.1), border: `1px solid ${c(0.25)}` }}>
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-xl font-bold leading-none" style={{ color: c(1) }}>7 días</p>
          <p className="text-[10px] text-white/40">racha actual</p>
        </div>
      </div>
      <div className="flex gap-2">
        {days.map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
              style={i < 7 ? { background: c(0.15), border: `1px solid ${c(0.35)}`, color: c(1) } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}>
              {i < 7 ? '✓' : '·'}
            </div>
            <span className="text-[9px] text-white/30">{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeedVisual() {
  return (
    <div className="space-y-2">
      {[
        { name: 'Ana', emoji: '🦋', dream: 'Un jardín con mariposas gigantes…', likes: 4 },
        { name: 'Carlos', emoji: '🌊', dream: 'El mar me hablaba en otro idioma…', likes: 7 },
      ].map(({ name, emoji, dream, likes }, i) => (
        <div key={name} className="rounded-xl p-3 flex items-start gap-2.5"
          style={{ background: c(0.07), border: `1px solid ${c(0.15)}`, animation: `fadeInUp 0.4s ${i * 0.1}s ease both` }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: c(0.2) }}>
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80">{name}</p>
            <p className="text-[11px] text-white/40 truncate">{dream}</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: c(0.7) }}>
            <span>♥</span><span>{likes}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CoincidenceVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style={{ background: c(0.1), border: `1px solid ${c(0.2)}` }}>🌊</div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c(0.9), animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <span className="text-[9px]" style={{ color: c(0.7) }}>coincidencia</span>
        </div>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style={{ background: c(0.1), border: `1px solid ${c(0.2)}` }}>🌊</div>
      </div>
      <div className="text-center rounded-2xl px-4 py-2.5" style={{ background: c(0.08), border: `1px solid ${c(0.22)}` }}>
        <p className="text-xs font-semibold text-white/80">Tú y Ana soñasteis con el mar</p>
        <p className="text-[10px] text-white/35 mt-0.5">Esta noche · Agua, océano</p>
      </div>
    </div>
  )
}

function MonitorVisual() {
  const heights = [4,6,14,22,30,22,18,10,6,4,8,18,28,32,28,20,12,6,4,8,24,32,28,18,10,6,4,10,20,28,24,16]
  return (
    <div className="rounded-2xl p-3 flex flex-col items-center gap-2" style={{ background: c(0.07), border: `1px solid ${c(0.18)}` }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full animate-pulse bg-red-400" />
        <span className="text-xs text-white/60">Grabando · 02:34</span>
      </div>
      <div className="flex items-end gap-px h-8 w-full">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 rounded-full"
            style={{ height: `${h}px`, background: i > 12 && i < 22 ? c(0.7) : 'rgba(255,255,255,0.15)' }} />
        ))}
      </div>
      <div className="flex gap-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: c(0.12), color: c(1) }}>🎙️ Voz detectada</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/40">✓ Sin ronquidos</span>
      </div>
    </div>
  )
}

function ShareVisual() {
  const templates = [
    { name: 'Cosmos', bg: 'linear-gradient(135deg,#0a0414,#1a0a3a)', emoji: '🌙' },
    { name: 'Nebulosa', bg: 'linear-gradient(135deg,#08011a,#3d0a5c)', emoji: '💜' },
    { name: 'Minimal', bg: '#000', emoji: '✦' },
    { name: 'Aurora', bg: 'linear-gradient(135deg,#010a1a,#0a2020)', emoji: '🌌' },
    { name: 'Medianoche', bg: 'linear-gradient(135deg,#03071e,#08023a)', emoji: '🌕' },
  ]
  return (
    <div className="flex gap-2 justify-center">
      {templates.map((t, i) => (
        <div key={t.name} className="flex flex-col items-center gap-1"
          style={{ animation: `fadeInUp 0.35s ${i * 0.06}s ease both` }}>
          <div className="w-10 h-16 rounded-xl flex items-center justify-center text-base"
            style={{ background: t.bg, border: `1px solid ${c(i === 0 ? 0.6 : 0.15)}`, boxShadow: i === 0 ? `0 0 12px ${c(0.4)}` : 'none' }}>
            {t.emoji}
          </div>
          <span className="text-[8px] text-white/35">{t.name}</span>
        </div>
      ))}
    </div>
  )
}

function FinalVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="text-5xl" style={{ animation: 'float 2.5s ease-in-out infinite', filter: `drop-shadow(0 0 20px ${c(0.5)})` }}>🌙</div>
        <div className="absolute -top-1 -right-2 text-xl" style={{ animation: 'tutSpin 3s linear infinite', color: c(1) }}>✦</div>
      </div>
      <div className="flex gap-2">
        {['Registra', 'Comparte', 'Descubre'].map((word, i) => (
          <span key={word} className="text-[11px] px-2.5 py-1 rounded-full text-white/70"
            style={{ background: c(0.1), border: `1px solid ${c(0.22)}`, animation: `fadeInUp 0.4s ${i * 0.1}s ease both` }}>
            {word}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Main overlay ──────────────────────────────────────────────── */
interface Props { open: boolean; onClose: () => void }

export function TutorialOverlay({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [animKey, setAnimKey] = useState(0)
  const [closing, setClosing] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  useEffect(() => {
    if (open) { setStep(0); setAnimKey(k => k + 1) }
  }, [open])

  const goTo = useCallback((next: number, direction: 'next' | 'prev') => {
    setDir(direction); setAnimKey(k => k + 1); setStep(next)
  }, [])

  function handleClose() {
    setClosing(true)
    setTimeout(() => { setClosing(false); onClose() }, 320)
    localStorage.setItem('tutorial-seen', '1')
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100]"
        style={{
          background: 'rgba(2,4,20,0.88)',
          backdropFilter: 'blur(18px)',
          animation: closing ? 'fadeOutBd 0.32s ease forwards' : 'fadeInBd 0.35s ease both',
        }} />

      {/* Celeste ambient glow */}
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${c(0.1)} 0%, transparent 70%)`, filter: 'blur(60px)' }} />
      </div>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[102] h-[3px]" style={{ background: c(0.1) }}>
        <div className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: `linear-gradient(90deg,${c(0.5)},${c(1)})`, boxShadow: `0 0 10px ${c(0.7)}` }} />
      </div>

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[101] px-4 pb-8 pt-2"
        style={{ animation: closing ? 'slideOut 0.32s cubic-bezier(0.4,0,1,1) forwards' : 'slideIn 0.48s cubic-bezier(0.34,1.15,0.64,1) both' }}>

        <div className="max-w-lg mx-auto w-full rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, rgba(0,20,35,0.97) 0%, rgba(4,6,22,0.99) 100%)',
            border: `1px solid ${c(0.28)}`,
            boxShadow: `0 -12px 60px ${c(0.12)}, 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 ${c(0.12)}`,
          }}>

          {/* Handle + counter */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: c(0.25) }} />
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium" style={{ color: c(0.6) }}>{step + 1}/{STEPS.length}</span>
              <button onClick={handleClose} className="text-[11px] text-white/25 hover:text-white/50 transition-colors px-2 py-1">
                Saltar
              </button>
            </div>
          </div>

          {/* Content — animates on step change */}
          <div key={animKey} className="px-6 pt-4 pb-2"
            style={{ animation: `${dir === 'next' ? 'stepInR' : 'stepInL'} 0.32s cubic-bezier(0.4,0,0.2,1) both` }}>

            {/* Emoji */}
            <div className="flex justify-center mb-4">
              <span className="text-5xl block" style={{ filter: `drop-shadow(0 0 20px ${c(0.5)})`, animation: 'float 3s ease-in-out infinite' }}>
                {current.emoji}
              </span>
            </div>

            {/* Visual */}
            <div className="mb-5">{current.visual}</div>

            {/* Text */}
            <h2 className="text-xl font-bold text-white text-center leading-tight mb-1 whitespace-pre-line">
              {current.title}
            </h2>
            <p className="text-xs font-semibold text-center mb-3" style={{ color: c(0.8) }}>
              {current.subtitle}
            </p>
            <p className="text-sm text-white/52 text-center leading-relaxed">
              {current.body}
            </p>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-1.5 py-4">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => goTo(i, i > step ? 'next' : 'prev')}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6, height: 6,
                  background: i === step ? c(0.9) : i < step ? c(0.3) : 'rgba(255,255,255,0.14)',
                  boxShadow: i === step ? `0 0 8px ${c(0.6)}` : 'none',
                }} />
            ))}
          </div>

          {/* Buttons */}
          <div className="px-6 pb-7 flex gap-3">
            {step > 0 && (
              <button onClick={() => goTo(step - 1, 'prev')}
                className="flex-none w-12 h-12 rounded-2xl flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}
            <button
              onClick={isLast ? handleClose : () => goTo(step + 1, 'next')}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg,${c(0.9)},${c(0.65)})`,
                color: '#001520',
                boxShadow: `0 4px 24px ${c(0.3)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}>
              {isLast
                ? <><span>¡Empezar a soñar!</span><span>🌙</span></>
                : <><span>Siguiente</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg></>
              }
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInBd  { from{opacity:0} to{opacity:1} }
        @keyframes fadeOutBd { from{opacity:1} to{opacity:0} }
        @keyframes slideIn   { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes slideOut  { from{transform:translateY(0)}    to{transform:translateY(110%)} }
        @keyframes stepInR   { from{opacity:0;transform:translateX(28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes stepInL   { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes tutSpin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </>
  )
}
