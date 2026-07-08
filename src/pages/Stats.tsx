import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../lib/queries'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_SHORT: Record<string, string> = {
  '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun',
  '07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic',
}

function formatMonth(m: string) {
  const [, mm] = m.split('-')
  return MONTHS_SHORT[mm] ?? mm
}

export default function Stats() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.get().then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {[1,2,3,4].map(i => <div key={i} className="glass-card rounded-2xl h-24 shimmer" />)}
    </div>
  )

  const total = Number(data?.totals?.total ?? 0)

  if (!data || total === 0) return (
    <div className="text-center py-20 animate-scale-in">
      <div className="text-7xl mb-5 animate-float inline-block">📊</div>
      <p className="text-white/50 font-medium">Sin datos todavía</p>
      <p className="text-white/25 text-sm mt-1">Registra sueños para ver tus estadísticas.</p>
    </div>
  )

  const lucid    = Number(data.totals.lucid ?? 0)
  const avgQ     = data.totals.avg_quality ? parseFloat(data.totals.avg_quality) : null
  const lucidPct = Number(data.lucidRatio ?? 0)

  // Weekday grid (0=Sun … 6=Sat)
  const weekMap: Record<number, number> = {}
  ;(data.byWeekday ?? []).forEach((r: { dow: number; count: string }) => {
    weekMap[r.dow] = Number(r.count)
  })
  const maxWeek = Math.max(1, ...Object.values(weekMap))

  // Month chart
  const monthData = (data.byMonth ?? []).map((r: { month: string; count: string }) => ({
    month: formatMonth(r.month),
    count: Number(r.count),
  }))
  const maxMonth = Math.max(1, ...monthData.map((d: { count: number }) => d.count))

  // Top emotion
  const topEmotion = data.topEmotions?.[0]?.emotion ?? null

  return (
    <div className="flex flex-col gap-4 animate-fade-in">

      {/* ── Hero KPI ── */}
      <div className="glass rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.7) 0%, transparent 70%)`, filter: 'blur(30px)' }} />
        <div className="relative z-10">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Universo onírico</p>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-6xl font-bold text-white leading-none">{total}</span>
            <span className="text-white/40 text-sm mb-2">sueños registrados</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon="🔥" value={`${data.streak}d`} label="Racha" glow />
            <MiniStat icon="✦" value={`${lucidPct}%`} label="Lúcidos" />
            <MiniStat icon="⭐" value={avgQ ? `${avgQ}` : '—'} label="Calidad" />
          </div>
        </div>
      </div>

      {/* ── Month activity ── */}
      {monthData.length > 0 && (
        <div className="glass-card rounded-3xl p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Actividad mensual</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthData} barSize={16}>
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ background: 'rgba(10,8,24,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                itemStyle={{ color: 'white' }}
              />
              <Bar dataKey="count" radius={[6,6,0,0]}>
                {monthData.map((entry: { count: number }, i: number) => (
                  <Cell key={i}
                    fill={entry.count === maxMonth
                      ? `rgba(var(--glow-color),0.9)`
                      : `rgba(var(--glow-color),${0.25 + (entry.count / maxMonth) * 0.4})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Weekday distribution ── */}
      {Object.keys(weekMap).length > 0 && (
        <div className="glass-card rounded-3xl p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Día más activo</p>
          <div className="flex items-end justify-between gap-1.5 h-16">
            {DAYS.map((d, i) => {
              const count = weekMap[i] ?? 0
              const h = maxWeek > 0 ? Math.max(4, (count / maxWeek) * 56) : 4
              const isMax = count === maxWeek && count > 0
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${h}px`,
                      background: isMax
                        ? `rgba(var(--glow-color),0.85)`
                        : `rgba(var(--glow-color),${count > 0 ? 0.2 + (count/maxWeek)*0.3 : 0.08})`,
                      boxShadow: isMax ? `0 0 12px rgba(var(--glow-color),0.5)` : 'none',
                    }} />
                  <span className={`text-[10px] ${isMax ? 'accent-text font-semibold' : 'text-white/30'}`}>{d}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Lucid vs Normal ── */}
      <div className="glass-card rounded-3xl p-5">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Tipo de sueños</p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-white/50">Normales</span>
              <span className="text-white/70 font-medium">{total - lucid}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${((total - lucid) / total) * 100}%`, background: `rgba(var(--glow-color),0.4)` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="accent-text font-medium">✦ Lúcidos</span>
              <span className="text-white/70 font-medium">{lucid}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full rounded-full transition-all animate-pulse-glow"
                style={{ width: `${(lucid / total) * 100}%`, background: `rgba(var(--glow-color),0.85)` }} />
            </div>
          </div>
        </div>
        {avgQ && (
          <div className="mt-4 pt-4 border-t border-white/6 flex items-center justify-between">
            <span className="text-xs text-white/40">Calidad media del descanso</span>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(n => (
                <span key={n} className={`text-sm ${n <= Math.round(avgQ) ? 'text-yellow-400' : 'text-white/15'}`}>★</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Emotions ── */}
      {data.topEmotions?.length > 0 && (
        <div className="glass-card rounded-3xl p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Emociones frecuentes</p>
          <div className="flex flex-col gap-2.5">
            {data.topEmotions.map((e: { emotion: string; count: string }, i: number) => {
              const max = Number(data.topEmotions[0].count)
              const pct = (Number(e.count) / max) * 100
              return (
                <div key={e.emotion} className="flex items-center gap-3">
                  <span className="text-xs text-white/60 w-20 truncate capitalize">{e.emotion}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: i === 0
                          ? `rgba(var(--glow-color),0.85)`
                          : `rgba(var(--glow-color),${0.6 - i * 0.07})`,
                      }} />
                  </div>
                  <span className="text-[11px] text-white/35 w-5 text-right">{e.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Symbols from AI ── */}
      {data.topSymbols?.length > 0 && (
        <div className="glass-card rounded-3xl p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Símbolos recurrentes</p>
          <p className="text-[10px] text-white/25 mb-3">Extraídos por IA de tus análisis</p>
          <div className="flex flex-wrap gap-2">
            {data.topSymbols.map((s: { symbol: string; count: string }, i: number) => {
              const size = Math.max(11, 15 - i)
              return (
                <span key={s.symbol}
                  className="px-3 py-1.5 rounded-full glass-pill transition-all"
                  style={{ fontSize: `${size}px` }}>
                  <span className="accent-text font-medium">{s.symbol}</span>
                  <span className="text-white/30 text-[10px] ml-1">×{s.count}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tags cloud ── */}
      {data.topTags?.length > 0 && (
        <div className="glass-card rounded-3xl p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Temas más etiquetados</p>
          <div className="flex flex-wrap gap-2">
            {data.topTags.map((t: { tag: string; count: string }, i: number) => {
              const max = Number(data.topTags[0].count)
              const opacity = 0.4 + (Number(t.count) / max) * 0.6
              return (
                <span key={t.tag}
                  className="px-3 py-1.5 rounded-full border text-xs font-medium transition-all"
                  style={{
                    borderColor: `rgba(var(--glow-color),${opacity * 0.5})`,
                    background: `rgba(var(--glow-color),${opacity * 0.12})`,
                    color: `rgba(255,255,255,${0.4 + opacity * 0.5})`,
                    fontSize: `${Math.max(10, 13 - i * 0.4)}px`,
                  }}>
                  #{t.tag}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Visibility split ── */}
      {data.byVisibility?.length > 0 && (
        <div className="glass-card rounded-3xl p-5 mb-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Visibilidad de tus sueños</p>
          <div className="flex flex-col gap-3">
            {data.byVisibility.map((v: { visibility: string; count: string }) => {
              const icons: Record<string, string> = { private: '🔒', friends: '👥', public: '🌐' }
              const labels: Record<string, string> = { private: 'Privados', friends: 'Para amigos', public: 'Públicos' }
              const pct = Math.round((Number(v.count) / total) * 100)
              return (
                <div key={v.visibility}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60">{icons[v.visibility]} {labels[v.visibility]}</span>
                    <span className="text-white/70 font-medium">{v.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: v.visibility === 'public'
                          ? 'rgba(52,211,153,0.7)'
                          : v.visibility === 'friends'
                            ? 'rgba(96,165,250,0.7)'
                            : `rgba(var(--glow-color),0.4)`,
                      }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {topEmotion && (
        <p className="text-center text-[11px] text-white/20 pb-2">
          Tu emoción más frecuente es <span className="accent-text font-medium">{topEmotion}</span> ✦
        </p>
      )}
    </div>
  )
}

function MiniStat({ icon, value, label, glow }: { icon: string; value: string; label: string; glow?: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-2.5 text-center ${glow ? 'glass-nav-active' : 'bg-white/5'}`}>
      <div className="text-base mb-0.5">{icon}</div>
      <div className={`text-base font-bold leading-tight ${glow ? 'text-white' : 'accent-text'}`}>{value}</div>
      <div className="text-[10px] text-white/30 mt-0.5">{label}</div>
    </div>
  )
}
