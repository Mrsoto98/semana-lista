import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../lib/queries'
import { Card } from '../components/ui/Card'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { emotionColor } from '../lib/utils'

const COLORS = ['#6750f0', '#8570ff', '#a395ff', '#c2baff', '#e0dcff']

export default function Stats() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.get().then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-dream-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data || data.totals.total === '0') {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-slate-400 text-lg">Registra sueños para ver tus estadísticas.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mis estadísticas</h1>
        <p className="text-slate-400 text-sm mt-0.5">Patrones y tendencias de tu mundo onírico</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <KPI label="Sueños totales" value={data.totals.total} icon="🌙" />
        <KPI label="Racha actual" value={`${data.streak} día${data.streak !== 1 ? 's' : ''}`} icon="🔥" />
        <KPI label="% Lúcidos" value={`${data.lucidRatio}%`} icon="✦" />
        <KPI
          label="Calidad media"
          value={data.totals.avg_quality ? `${data.totals.avg_quality}/5 ★` : '—'}
          icon="⭐"
        />
      </div>

      {/* Dreams by month */}
      {data.byMonth.length > 0 && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Sueños por mes</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.byMonth}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="count" fill="#6750f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Top emotions */}
        {data.topEmotions.length > 0 && (
          <Card>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Emociones frecuentes</h3>
            <div className="flex flex-col gap-2">
              {data.topEmotions.map((e) => (
                <div key={e.emotion} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${emotionColor(e.emotion)}`}>
                    {e.emotion}
                  </span>
                  <span className="text-xs text-slate-500">{e.count}×</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Top symbols */}
        {data.topSymbols.length > 0 && (
          <Card>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Símbolos recurrentes</h3>
            <div className="flex flex-col gap-2">
              {data.topSymbols.map((s, i) => (
                <div key={s.symbol} className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">{s.symbol}</span>
                  <span className="text-xs text-dream-400">{s.count}×</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Top tags */}
      {data.topTags.length > 0 && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Temas más etiquetados</h3>
          <div className="flex flex-wrap gap-2">
            {data.topTags.map((t, i) => (
              <span
                key={t.tag}
                className="px-3 py-1 rounded-full text-xs font-medium bg-dream-900/50 text-dream-300 border border-dream-700/30"
                style={{ fontSize: `${Math.max(11, 11 + i * -0.5)}px` }}
              >
                #{t.tag} <span className="text-dream-600">{t.count}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Visibility distribution */}
      {data.byVisibility.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium text-slate-300 mb-4">Distribución por visibilidad</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={data.byVisibility} dataKey="count" nameKey="visibility" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
                  {data.byVisibility.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2">
              {data.byVisibility.map((v, i) => (
                <div key={v.visibility} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-slate-400 capitalize">{v.visibility}</span>
                  <span className="text-white font-medium">{v.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function KPI({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <Card className="text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </Card>
  )
}
