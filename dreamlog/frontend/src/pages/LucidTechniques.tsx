import { useState, useEffect, useRef, useCallback } from 'react'

interface Technique {
  id: string
  emoji: string
  name: string
  full: string
  tagline: string
  difficulty: number
  description: string
  steps: string[]
  tip: string
  color: string
}

const TECHNIQUES: Technique[] = [
  {
    id: 'wbtb',
    emoji: '⏰',
    name: 'WBTB',
    full: 'Wake Back To Bed',
    tagline: 'El truco del ciclo REM',
    difficulty: 2,
    description:
      'Despiertas tras 5-6h de sueño, permaneces despierto 20-30 minutos y vuelves a dormir. Aprovecha la fase REM más intensa del amanecer.',
    steps: [
      'Pon una alarma para 5-6 horas después de acostarte',
      'Al despertar, levántate y permanece despierto 20-30 min',
      'Lee sobre sueños lúcidos o escribe en tu diario durante ese tiempo',
      'Vuelve a la cama con la intención de soñar lúcidamente',
      'Aplica MILD o WILD al volver a dormirte',
    ],
    tip: 'Aumenta la probabilidad de sueño lúcido en un 2000% según estudios',
    color: 'rgba(6,182,212',
  },
  {
    id: 'mild',
    emoji: '🔮',
    name: 'MILD',
    full: 'Mnemonic Induction of Lucid Dreams',
    tagline: 'La intención es la llave',
    difficulty: 1,
    description:
      'Antes de dormir, repites una intención con convicción. Desarrollada por el investigador Stephen LaBerge, es la técnica más accesible y respaldada científicamente.',
    steps: [
      'Justo antes de dormirte, di mentalmente: "Esta noche me daré cuenta de que estoy soñando"',
      'Visualiza que ya has tenido un sueño lúcido hoy',
      'Siente la emoción de ser consciente dentro del sueño',
      'Repite la afirmación hasta quedarte dormido',
      'Al despertar de noche, anota el sueño y repite el proceso',
    ],
    tip: 'Combínalo con un diario de sueños para resultados más rápidos',
    color: 'rgba(236,72,153',
  },
  {
    id: 'dild',
    emoji: '💡',
    name: 'DILD',
    full: 'Dream-Initiated Lucid Dream',
    tagline: 'Despertar dentro del sueño',
    difficulty: 1,
    description:
      'La forma más común de sueño lúcido: te das cuenta de que estás soñando mientras ya estás dentro de un sueño, normalmente al notar algo extraño o hacer una comprobación de realidad.',
    steps: [
      'Durante el día, practica comprobaciones de realidad cada 1-2 horas',
      'Hazte la pregunta: "¿Estoy soñando ahora mismo?"',
      'Comprueba tus manos, intenta atravesar una pared o mira un texto dos veces',
      'Este hábito se trasladará a tus sueños automáticamente',
      'Al notar algo raro en el sueño, haz la comprobación — ¡y lo estarás!',
      'Estabiliza el sueño frotando las manos o mirando el suelo',
    ],
    tip: 'La técnica más natural — solo requiere constancia en las comprobaciones diarias',
    color: 'rgba(251,191,36',
  },
  {
    id: 'ssild',
    emoji: '🌀',
    name: 'SSILD',
    full: 'Senses Initiated Lucid Dream',
    tagline: 'Cicla tus sentidos para despertar',
    difficulty: 2,
    description:
      'Ciclas lentamente entre tus sentidos (vista, oído, tacto) sin intentar dormirte ni analizar nada. El cerebro entra en estado de sueño de forma natural. Muy alta tasa de éxito reportada.',
    steps: [
      'Haz WBTB: despierta tras 4-6h y vuelve a la cama tras 10-20 min',
      'Acuéstate cómodo y cierra los ojos',
      'Ciclo 1 — Vista: observa la oscuridad detrás de tus párpados 20-30 seg',
      'Ciclo 1 — Oído: escucha los sonidos del ambiente 20-30 seg',
      'Ciclo 1 — Tacto: siente el peso y temperatura de tu cuerpo 20-30 seg',
      'Repite el ciclo 4-5 veces de forma relajada, sin forzar',
      'En el último ciclo, hazlo más rápido y deja que el sueño llegue',
    ],
    tip: 'No trates de ver nada especial — la pasividad es la clave del SSILD',
    color: 'rgba(16,185,129',
  },
  {
    id: 'wild',
    emoji: '🌊',
    name: 'WILD',
    full: 'Wake-Initiated Lucid Dream',
    tagline: 'Entrar consciente en el sueño',
    difficulty: 3,
    description:
      'Mantienes la conciencia mientras tu cuerpo se queda dormido. Es la técnica más potente y directa, pero requiere práctica y calma para no romper el estado.',
    steps: [
      'Acuéstate boca arriba en posición cómoda',
      'Relaja todo el cuerpo comenzando por los pies, luego piernas, abdomen, pecho, brazos, cara',
      'Observa los hipnagogos (formas y colores que aparecen al cerrar los ojos)',
      'No te enganches a ninguna imagen — solo observa como si fueran nubes',
      'Sentirás parálisis del sueño (presión, zumbido, vibración) — es normal, no te asustes',
      'Cuando las imágenes se vuelvan estables, "cae" dentro de una',
      'Mantén la calma al darte cuenta de que estás soñando',
    ],
    tip: 'Mejor practicar durante el WBTB (tras 5-6h de sueño)',
    color: 'rgba(139,92,246',
  },
  {
    id: 'fild',
    emoji: '🖐️',
    name: 'FILD',
    full: 'Finger-Induced Lucid Dream',
    tagline: 'El truco del dedo dormido',
    difficulty: 2,
    description:
      'Al borde del sueño, mueves dos dedos de forma imperceptible (como si tocaras una nota de piano muy suave) para mantener un hilo de conciencia mientras te duermes.',
    steps: [
      'Haz WBTB: despierta tras 4-6h y vuelve a la cama muy somnoliento',
      'Cuando estés a punto de dormirte, empieza a mover el índice y corazón alternativamente',
      'El movimiento debe ser casi imperceptible — solo la intención de moverlos',
      'Mantén ese movimiento sutil durante 30-60 segundos',
      'Haz una comprobación de realidad: intenta pellizcar tu nariz y respirar',
      'Si puedes respirar con la nariz tapada, ¡estás soñando! Abre "los ojos" del sueño',
    ],
    tip: 'Funciona mejor cuando estás muy somnoliento — el cuerpo ya casi duerme',
    color: 'rgba(245,101,101',
  },
  {
    id: 'deild',
    emoji: '🔁',
    name: 'DEILD',
    full: 'Dream Exit Induced Lucid Dream',
    tagline: 'Re-entrar en el sueño sin despertar',
    difficulty: 3,
    description:
      'Cuando te despiertas de un sueño (especialmente de madrugada), no abres los ojos ni te mueves, y te deslizas de vuelta al sueño de forma consciente. Muy poderoso si dominas la quietud.',
    steps: [
      'Cuando te despiertes de un sueño, NO ABRAS LOS OJOS y no te muevas',
      'Permanece completamente inmóvil durante 10-30 segundos',
      'Mantén en mente la escena del sueño del que acabas de salir',
      'Sentirás vibración o presión — es la parálisis del sueño entrando',
      'Deja que las imágenes vuelvan y "cae" dentro de ellas',
      'Estarás de vuelta en el sueño, pero ahora de forma lúcida',
    ],
    tip: 'Pon el teléfono fuera del alcance para no romper el estado al apagar la alarma',
    color: 'rgba(99,102,241',
  },
]

const EXPERT_TIPS = [
  'Los sueños lúcidos ocurren en fase REM — más frecuentes en la segunda mitad de la noche. Por eso el WBTB es tan eficaz.',
  'Un diario de sueños es el paso más importante. Sin memoria onírica no puedes reconocer que estás soñando.',
  'No fuerces — la ansiedad de "querer" el sueño lúcido es el mayor enemigo. La lucidez llega cuando te relajas.',
  'La consistencia es clave: registra todos tus sueños, también los que no son lúcidos. La cantidad precede a la calidad.',
  'Al conseguir lucidez, frota las manos o mira el suelo para estabilizar el sueño y evitar que se desvanezca.',
  'La vitamina B6 (100mg antes de dormir) puede aumentar la viveza y recordación de los sueños según algunos estudios.',
  'Los sueños lúcidos no son peligrosos — siempre puedes despertar cerrando los ojos del sueño y diciéndote "despierta".',
  'Los "signos onírticos" son elementos que aparecen en muchos de tus sueños. Identifícalos en tu diario y úsalos como disparadores de lucidez.',
  'Combinar WBTB + SSILD o WBTB + MILD duplica o triplica las probabilidades respecto a usar cada técnica sola.',
]

const REALITY_CHECKS = [
  {
    emoji: '🖐️',
    title: 'Mirar las manos',
    desc: 'Cuenta tus dedos. En sueños suelen aparecer 4 o 7.',
  },
  {
    emoji: '📖',
    title: 'Leer texto',
    desc: 'Lee algo. En sueños, el texto cambia al releerlo.',
  },
  {
    emoji: '👃',
    title: 'Tapar nariz',
    desc: 'Aprieta la nariz e intenta respirar. En sueños podrás.',
  },
  {
    emoji: '🕐',
    title: 'Mirar el reloj',
    desc: 'Mira un reloj, aparta la vista y vuelve a mirarlo. En sueños la hora cambia.',
  },
  {
    emoji: '💡',
    title: 'Interrumpir luz',
    desc: 'Prueba un interruptor. En sueños las luces no se apagan o encienden bien.',
  },
  {
    emoji: '🤏',
    title: 'Pellizco',
    desc: 'Pellízcate la nariz o el brazo. En sueños no duele o la sensación es extraña.',
  },
]

function RealityCheckCard({ rc }: { rc: { emoji: string; title: string; desc: string } }) {
  const [open, setOpen] = useState(false)
  const [pressed, setPressed] = useState(false)
  const descRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback(() => {
    setPressed(true)
    setTimeout(() => setPressed(false), 180)
    setOpen(o => !o)
  }, [])

  return (
    <button
      onClick={handleClick}
      className="glass-card rounded-2xl text-left transition-all duration-200 overflow-hidden w-full"
      style={{
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        boxShadow: open
          ? '0 0 24px rgba(var(--glow-color),0.18), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        border: open
          ? '1px solid rgba(var(--glow-color),0.3)'
          : '1px solid rgba(255,255,255,0.06)',
        transition: 'transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease, border-color 0.25s ease',
      }}
    >
      {/* Always visible: emoji + title */}
      <div className="p-4 flex flex-col items-center gap-2">
        <span
          className="text-3xl transition-all duration-300"
          style={{
            transform: open ? 'scale(1.18) rotate(-6deg)' : 'scale(1) rotate(0deg)',
            filter: open ? 'drop-shadow(0 0 8px rgba(var(--glow-color),0.6))' : 'none',
            display: 'block',
            transition: 'transform 0.35s cubic-bezier(.34,1.56,.64,1), filter 0.3s ease',
          }}
        >
          {rc.emoji}
        </span>
        <p className="text-xs font-semibold text-white leading-tight text-center">{rc.title}</p>
        <div
          className="transition-all duration-300"
          style={{ opacity: open ? 0 : 1, transform: open ? 'translateY(-4px)' : 'translateY(0)' }}
        >
          <span className="text-[10px] text-white/25">Toca para saber más</span>
        </div>
      </div>

      {/* Expandable description */}
      <div
        ref={descRef}
        style={{
          maxHeight: open ? '120px' : '0px',
          opacity: open ? 1 : 0,
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
          overflow: 'hidden',
        }}
      >
        <div
          className="px-4 pb-4 pt-1 border-t text-center"
          style={{ borderColor: 'rgba(var(--glow-color),0.15)', background: 'rgba(var(--glow-color),0.05)' }}
        >
          <p className="text-xs text-white/70 leading-relaxed">{rc.desc}</p>
        </div>
      </div>
    </button>
  )
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((dot) => (
        <div
          key={dot}
          className={`w-2 h-2 rounded-full transition-all ${
            dot <= level ? 'opacity-100' : 'opacity-20'
          }`}
          style={{
            background: dot <= level ? 'rgba(var(--glow-color), 1)' : 'rgba(255,255,255,0.3)',
          }}
        />
      ))}
      <span className="ml-1 text-xs text-white/40">
        {level === 1 ? 'Fácil' : level === 2 ? 'Medio' : 'Difícil'}
      </span>
    </div>
  )
}

function TechniqueCard({ technique }: { technique: Technique }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="glass-card rounded-3xl overflow-hidden transition-all duration-300"
      style={{
        boxShadow: `0 4px 32px ${technique.color}, 0.12), inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
    >
      {/* Card header */}
      <div
        className="p-6"
        style={{
          background: `linear-gradient(135deg, ${technique.color}, 0.12) 0%, ${technique.color}, 0.04) 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: `${technique.color}, 0.18)`,
                border: `1px solid ${technique.color}, 0.3)`,
              }}
            >
              {technique.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-xl font-bold text-white">{technique.name}</h3>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: `${technique.color}, 0.2)`,
                    color: `${technique.color}, 0.9)`,
                    border: `1px solid ${technique.color}, 0.3)`,
                  }}
                >
                  {technique.full}
                </span>
              </div>
              <p className="text-white/60 text-sm">{technique.tagline}</p>
            </div>
          </div>
          <DifficultyDots level={technique.difficulty} />
        </div>

        <p className="mt-4 text-white/70 text-sm leading-relaxed">{technique.description}</p>

        {/* Tip banner */}
        <div
          className="mt-4 flex items-start gap-2 rounded-xl p-3"
          style={{
            background: `${technique.color}, 0.1)`,
            border: `1px solid ${technique.color}, 0.2)`,
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: `${technique.color}, 0.8)` }} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-white/60">{technique.tip}</p>
        </div>
      </div>

      {/* Steps toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-white/70 hover:text-white transition-colors border-t border-white/8"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <span>Ver pasos ({technique.steps.length})</span>
        <svg
          className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Collapsible steps */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? `${technique.steps.length * 64 + 32}px` : '0px', opacity: expanded ? 1 : 0 }}
      >
        <ol className="px-6 pb-6 space-y-3">
          {technique.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                style={{
                  background: `${technique.color}, 0.2)`,
                  color: `${technique.color}, 0.9)`,
                  border: `1px solid ${technique.color}, 0.3)`,
                }}
              >
                {i + 1}
              </span>
              <span className="text-sm text-white/70 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function WBTBTimer() {
  const [timerActive, setTimerActive] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerPhase, setTimerPhase] = useState<'sleep' | 'awake'>('sleep')
  const [alarmFired, setAlarmFired] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimerActive(false)
    setTimerSeconds(0)
    setAlarmFired(false)
  }

  const startTimer = (phase: 'sleep' | 'awake') => {
    stopTimer()
    setAlarmFired(false)
    setTimerPhase(phase)
    const totalSeconds = phase === 'sleep' ? Math.round(5.5 * 3600) : 25 * 60
    setTimerSeconds(totalSeconds)
    setTimerActive(true)

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    let remaining = totalSeconds
    timerRef.current = setInterval(() => {
      remaining -= 1
      setTimerSeconds(remaining)
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        setTimerActive(false)
        setAlarmFired(true)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(
            phase === 'sleep' ? '¡Es hora de despertar! ⏰' : '¡Vuelve a la cama! 🌙',
            {
              body:
                phase === 'sleep'
                  ? 'Han pasado 5.5 horas. Levántate 20-30 min para el WBTB.'
                  : 'Han pasado 25 minutos. Aplica MILD o WILD al dormir.',
              icon: '/favicon.ico',
            }
          )
        }
      }
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'rgba(6,182,212,0.18)', border: '1px solid rgba(6,182,212,0.3)' }}
        >
          ⏰
        </div>
        <div>
          <h3 className="font-bold text-white">Temporizador WBTB</h3>
          <p className="text-sm text-white/50">Automatiza tu ciclo de sueño</p>
        </div>
      </div>

      {alarmFired && (
        <div
          className="mb-4 rounded-2xl p-4 text-center animate-scale-in"
          style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}
        >
          <p className="text-lg font-bold text-white mb-1">
            {timerPhase === 'sleep' ? '¡Despierta! ⏰' : '¡Vuelve a dormir! 🌙'}
          </p>
          <p className="text-sm text-white/60">
            {timerPhase === 'sleep'
              ? 'Levántate 20-30 minutos y luego vuelve a la cama.'
              : 'Aplica MILD o WILD al dormirte. ¡Buena suerte!'}
          </p>
          <button
            onClick={() => setAlarmFired(false)}
            className="mt-3 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}

      {timerActive ? (
        <div className="text-center">
          <p className="text-sm text-white/50 mb-2">
            {timerPhase === 'sleep' ? 'Alarma en' : 'Tiempo despierto'}
          </p>
          <div
            className="text-5xl font-mono font-bold mb-2 accent-text"
            style={{ letterSpacing: '0.05em' }}
          >
            {formatTime(timerSeconds)}
          </div>
          <p className="text-xs text-white/40 mb-6">
            {timerPhase === 'sleep'
              ? 'Duerme — te avisaremos cuando sea hora'
              : 'Permanece despierto — vuelve a la cama al llegar a 0'}
          </p>
          <button onClick={stopTimer} className="glass-btn-secondary rounded-xl px-6 py-2 text-sm">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => startTimer('sleep')}
            className="glass-btn-primary rounded-xl px-4 py-3 text-sm font-medium flex flex-col items-center gap-1"
          >
            <span>⏰ Alarma 5.5h</span>
            <span className="text-xs opacity-70">Programar despertar</span>
          </button>
          <button
            onClick={() => startTimer('awake')}
            className="glass-btn-secondary rounded-xl px-4 py-3 text-sm font-medium flex flex-col items-center gap-1"
          >
            <span>🌙 Cuenta regresiva</span>
            <span className="text-xs opacity-70">25 min despierto</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function LucidTechniques() {
  return (
    <div className="animate-fade-in flex flex-col gap-6 pb-6">
      {/* Header */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 animate-float"
            style={{
              background: 'rgba(var(--glow-color), 0.18)',
              border: '1px solid rgba(var(--glow-color), 0.3)',
            }}
          >
            ✨
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">
              Técnicas de sueño lúcido
            </h1>
            <p className="text-white/60 mt-1 text-sm leading-relaxed">
              Entrena tu mente para despertar dentro del sueño
            </p>
          </div>
        </div>
      </div>

      {/* Reality checks row */}
      <div>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 px-1">
          Comprobaciones de realidad
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {REALITY_CHECKS.map((rc) => (
            <RealityCheckCard key={rc.title} rc={rc} />
          ))}
        </div>
      </div>

      {/* Technique cards */}
      <div>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 px-1">
          Técnicas principales
        </h2>
        <div className="flex flex-col gap-4">
          {TECHNIQUES.map((technique) => (
            <>
              <TechniqueCard key={technique.id} technique={technique} />
              {technique.id === 'wbtb' && <WBTBTimer />}
            </>
          ))}
        </div>
      </div>

      {/* Expert tips */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
            style={{
              background: 'rgba(var(--glow-color), 0.18)',
              border: '1px solid rgba(var(--glow-color), 0.3)',
            }}
          >
            🧠
          </div>
          <h2 className="font-bold text-white">Tips de experto</h2>
        </div>
        <ul className="space-y-4">
          {EXPERT_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
                style={{ background: 'rgba(var(--glow-color), 0.2)' }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'rgba(var(--glow-color), 1)' }}
                />
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{tip}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
