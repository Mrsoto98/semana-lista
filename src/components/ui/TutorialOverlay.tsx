import { useState, useEffect, useCallback } from 'react'

const STEPS = [
  {
    emoji: '🌙',
    emojiAnim: 'float',
    title: 'Bienvenido a\nBitácora del Sueño',
    subtitle: 'Tu diario onírico personal',
    body: 'Registra tus sueños cada mañana, conecta con amigos, descubre coincidencias y entrena la lucidez. Todo en un solo lugar.',
    color: 'rgba(139,92,246',
    visual: <IntroVisual />,
  },
  {
    emoji: '📖',
    emojiAnim: 'bounce',
    title: 'Tu Diario',
    subtitle: 'Registra cada sueño',
    body: 'Añade el título, descripción, emociones y etiquetas. Marca si fue lúcido para llevar un seguimiento especial. Tus sueños se guardan en orden cronológico.',
    color: 'rgba(236,72,153',
    visual: <DiaryVisual />,
  },
  {
    emoji: '🔥',
    emojiAnim: 'pulse',
    title: 'Racha de días',
    subtitle: 'Construye el hábito',
    body: 'Cada día que registras un sueño suma a tu racha. Cuantos más días consecutivos, más vívidos y memorables se vuelven tus sueños.',
    color: 'rgba(245,158,11',
    visual: <StreakVisual />,
  },
  {
    emoji: '👥',
    emojiAnim: 'float',
    title: 'Feed de amigos',
    subtitle: 'Comparte el mundo onírico',
    body: 'Ve los sueños que tus amigos comparten. Dale like, comenta y descubre mundos imaginarios que nunca esperarías.',
    color: 'rgba(6,182,212',
    visual: <FeedVisual />,
  },
  {
    emoji: '✨',
    emojiAnim: 'spin',
    title: 'Coincidencias',
    subtitle: 'La magia de soñar juntos',
    body: 'Cuando tú y un amigo soñáis con los mismos elementos —agua, vuelo, laberintos— la app lo detecta y os notifica. ¿Casualidad o conexión?',
    color: 'rgba(251,191,36',
    visual: <CoincidenceVisual />,
  },
  {
    emoji: '🎤',
    emojiAnim: 'pulse',
    title: 'Monitor de sueño',
    subtitle: 'Escucha lo que pasa de noche',
    body: 'Actívalo antes de dormir y detectará automáticamente ronquidos y habla mientras duermes. Todo se guarda solo en tu dispositivo.',
    color: 'rgba(239,68,68',
    visual: <MonitorVisual />,
  },
  {
    emoji: '🔮',
    emojiAnim: 'float',
    title: 'Técnicas lúcidas',
    subtitle: 'Despierta dentro del sueño',
    body: 'WILD, MILD, WBTB, SSILD, FILD y DEILD — todas las técnicas explicadas paso a paso con temporizadores integrados.',
    color: 'rgba(99,102,241',
    visual: <TechniquesVisual />,
  },
  {
    emoji: '🚀',
    emojiAnim: 'bounce',
    title: '¡Todo listo!',
    subtitle: 'El primer sueño te espera',
    body: 'Empieza esta noche. Mañana al despertar, abre la app y registra lo que recuerdes — aunque sean solo fragmentos. La práctica hace al maestro.',
    color: 'rgba(16,185,129',
    visual: <FinalVisual />,
  },
]

// ── Visual components ────────────────────────────────────────────
function IntroVisual() {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {['📖','✨','👥','🎤','🔮'].map((e, i) => (
        <div key={e} className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg glass-card"
          style={{ animationDelay: `${i * 0.1}s`, animation: 'fadeInUp 0.5s ease both' }}>
          {e}
        </div>
      ))}
    </div>
  )
}

function DiaryVisual() {
  return (
    <div className="rounded-2xl p-3 glass-card text-left space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-xs font-semibold text-white/80">Vuelo sobre el mar</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-purple-300"
          style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' }}>
          ✦ Lúcido
        </span>
      </div>
      <p className="text-[11px] text-white/40 leading-relaxed">Volaba sobre el océano al atardecer, podía sentir el viento…</p>
      <div className="flex gap-1.5">
        {['vuelo','mar','paz'].map(t => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/40">#{t}</span>
        ))}
      </div>
    </div>
  )
}

function StreakVisual() {
  const days = ['L','M','X','J','V','S','D']
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl"
        style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-xl font-bold text-amber-400 leading-none">7 días</p>
          <p className="text-[10px] text-white/40">racha actual</p>
        </div>
      </div>
      <div className="flex gap-2">
        {days.map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${i < 7 ? 'text-amber-400' : 'text-white/20'}`}
              style={i < 7 ? { background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)' } : { background: 'rgba(255,255,255,0.05)' }}>
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
      ].map(({ name, emoji, dream, likes }) => (
        <div key={name} className="glass-card rounded-xl p-3 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: 'rgba(var(--glow-color),0.3)' }}>
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80">{name}</p>
            <p className="text-[11px] text-white/40 truncate">{dream}</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/30 shrink-0">
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
        <div className="w-10 h-10 rounded-2xl glass-card flex items-center justify-center text-lg">🌊</div>
        <div className="flex flex-col items-center">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'rgba(251,191,36,0.8)', animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
          <span className="text-[9px] text-amber-400/70 mt-1">coincidencia</span>
        </div>
        <div className="w-10 h-10 rounded-2xl glass-card flex items-center justify-center text-lg">🌊</div>
      </div>
      <div className="text-center rounded-2xl px-4 py-2"
        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
        <p className="text-xs font-semibold text-amber-300">Tú y Ana soñasteis con el mar</p>
        <p className="text-[10px] text-white/35 mt-0.5">Esta noche • Agua, océano</p>
      </div>
    </div>
  )
}

function MonitorVisual() {
  return (
    <div className="glass-card rounded-2xl p-3 flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        <span className="text-xs text-white/60">Grabando · 02:34</span>
      </div>
      <div className="flex items-end gap-px h-8 w-full">
        {Array.from({ length: 32 }, (_, i) => {
          const h = [4,6,14,22,30,22,18,10,6,4,8,18,28,32,28,20,12,6,4,8,24,32,28,18,10,6,4,10,20,28,24,16][i] || 4
          const isSnore = i > 12 && i < 22
          return (
            <div key={i} className="flex-1 rounded-full"
              style={{ height: `${h}px`, background: isSnore ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.15)' }} />
          )
        })}
      </div>
      <div className="flex gap-3">
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>🟡 12s ronquido</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#6ee7b7' }}>✓ Sin habla</span>
      </div>
    </div>
  )
}

function TechniquesVisual() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { name: 'MILD', color: 'rgba(236,72,153', diff: '●○○' },
        { name: 'WBTB', color: 'rgba(6,182,212', diff: '●●○' },
        { name: 'WILD', color: 'rgba(139,92,246', diff: '●●●' },
        { name: 'SSILD', color: 'rgba(16,185,129', diff: '●●○' },
        { name: 'FILD', color: 'rgba(245,101,101', diff: '●●○' },
        { name: 'DEILD', color: 'rgba(99,102,241', diff: '●●●' },
      ].map(({ name, color, diff }) => (
        <div key={name} className="rounded-xl p-2 text-center"
          style={{ background: `${color},0.1)`, border: `1px solid ${color},0.25)` }}>
          <p className="text-xs font-bold text-white">{name}</p>
          <p className="text-[9px] mt-0.5" style={{ color: `${color},0.8)` }}>{diff}</p>
        </div>
      ))}
    </div>
  )
}

function FinalVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="text-5xl animate-bounce">🌙</div>
        <div className="absolute -top-1 -right-1 text-xl animate-spin" style={{ animationDuration: '3s' }}>✨</div>
      </div>
      <div className="flex gap-2">
        {['Registra','Comparte','Descubre'].map((word, i) => (
          <span key={word} className="text-[11px] px-2.5 py-1 rounded-full text-white/70"
            style={{ background: 'rgba(var(--glow-color),0.12)', border: '1px solid rgba(var(--glow-color),0.2)', animationDelay: `${i*0.15}s`, animation: 'fadeInUp 0.5s ease both' }}>
            {word}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
}

export function TutorialOverlay({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [animKey, setAnimKey] = useState(0)
  const [closing, setClosing] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    if (open) { setStep(0); setAnimKey(k => k + 1) }
  }, [open])

  const goTo = useCallback((next: number, direction: 'next' | 'prev') => {
    setDir(direction)
    setAnimKey(k => k + 1)
    setStep(next)
  }, [])

  function handleClose() {
    setClosing(true)
    setTimeout(() => { setClosing(false); onClose() }, 350)
    localStorage.setItem('tutorial-seen', '1')
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100]"
        style={{
          background: 'rgba(5,4,15,0.85)',
          backdropFilter: 'blur(12px)',
          animation: closing ? 'fadeOutBackdrop 0.35s ease forwards' : 'fadeInBackdrop 0.4s ease both',
        }}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[101] flex flex-col px-4 pb-8 pt-3"
        style={{
          animation: closing ? 'slideSheetOut 0.35s cubic-bezier(0.4,0,1,1) forwards' : 'slideSheetIn 0.5s cubic-bezier(0.34,1.2,0.64,1) both',
        }}
      >
        <div className="max-w-lg mx-auto w-full rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, rgba(20,15,45,0.98) 0%, rgba(10,8,24,0.99) 100%)',
            border: `1px solid ${current.color},0.3)`,
            boxShadow: `0 -8px 60px ${current.color},0.15), 0 0 0 1px rgba(255,255,255,0.04)`,
            transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
          }}>

          {/* Handle + skip */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/15" />
            <button onClick={handleClose} className="text-[11px] text-white/25 hover:text-white/50 transition-colors px-2 py-1">
              Saltar
            </button>
          </div>

          {/* Step content */}
          <div
            key={animKey}
            className="px-6 pt-3 pb-2"
            style={{
              animation: `${dir === 'next' ? 'stepInRight' : 'stepInLeft'} 0.35s cubic-bezier(0.4,0,0.2,1) both`,
            }}
          >
            {/* Emoji */}
            <div className="flex justify-center mb-4">
              <span
                className="text-5xl block"
                style={{
                  animation: current.emojiAnim === 'float'
                    ? 'float 3s ease-in-out infinite'
                    : current.emojiAnim === 'bounce'
                    ? 'tutBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) both'
                    : current.emojiAnim === 'pulse'
                    ? 'tutPulse 1.5s ease infinite'
                    : 'tutSpin 4s linear infinite',
                  filter: `drop-shadow(0 0 16px ${current.color},0.5))`,
                }}
              >
                {current.emoji}
              </span>
            </div>

            {/* Visual */}
            <div className="mb-5">
              {current.visual}
            </div>

            {/* Text */}
            <h2 className="text-xl font-bold text-white text-center leading-tight mb-1 whitespace-pre-line">
              {current.title}
            </h2>
            <p className="text-xs font-semibold text-center mb-3" style={{ color: `${current.color},0.8)` }}>
              {current.subtitle}
            </p>
            <p className="text-sm text-white/55 text-center leading-relaxed">
              {current.body}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 py-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > step ? 'next' : 'prev')}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  background: i === step ? `${current.color},0.9)` : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="px-6 pb-6 flex gap-3">
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1, 'prev')}
                className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white/50 hover:text-white/70 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                ← Atrás
              </button>
            )}
            <button
              onClick={isLast ? handleClose : () => goTo(step + 1, 'next')}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${current.color},0.85) 0%, ${current.color},0.65) 100%)`,
                boxShadow: `0 4px 20px ${current.color},0.3)`,
                border: `1px solid ${current.color},0.4)`,
              }}
            >
              {isLast ? '¡Empezar! 🌙' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInBackdrop  { from { opacity:0 } to { opacity:1 } }
        @keyframes fadeOutBackdrop { from { opacity:1 } to { opacity:0 } }
        @keyframes slideSheetIn  { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes slideSheetOut { from { transform:translateY(0) }    to { transform:translateY(110%) } }
        @keyframes stepInRight   { from { opacity:0; transform:translateX(32px) } to { opacity:1; transform:translateX(0) } }
        @keyframes stepInLeft    { from { opacity:0; transform:translateX(-32px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeInUp      { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes tutBounce     { 0%{transform:scale(0.5) translateY(20px)} 70%{transform:scale(1.1)} 100%{transform:scale(1) translateY(0)} }
        @keyframes tutPulse      { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
        @keyframes tutSpin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </>
  )
}
