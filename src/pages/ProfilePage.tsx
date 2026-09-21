import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { formatUserNumber } from '../lib/formatUserNumber'
import type { Dream } from '../types'

const DREAM_GRADIENTS = [
  'linear-gradient(135deg, #0f3460 0%, #533483 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #3d0f72 100%)',
  'linear-gradient(135deg, #2c3e50 0%, #4a6fa5 100%)',
  'linear-gradient(135deg, #0d0d2b 0%, #164778 100%)',
  'linear-gradient(135deg, #130f40 0%, #1a6b4b 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #5c1a2e 100%)',
  'linear-gradient(135deg, #000428 0%, #004e92 100%)',
  'linear-gradient(135deg, #1e1b4b 0%, #0b8793 100%)',
  'linear-gradient(135deg, #2c1654 0%, #3d5a80 100%)',
]

function getGradient(id: string) {
  const num = id.replace(/-/g, '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return DREAM_GRADIENTS[num % DREAM_GRADIENTS.length]
}

const EMOTION_COLORS = ['#7C6FE8', '#64D4B8', '#B8A4E8', '#E85858', '#4CAF82', '#A89BF5', '#F5A524', '#E87C6F']
const MONTH_LABELS   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState<'sueños' | 'estadísticas'>('sueños')

  const { data: dreams = [], isLoading } = useQuery({
    queryKey: ['my-dreams-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dreams')
        .select('id, title, body, dream_date, is_lucid, emotions, tags, visibility, summary')
        .eq('user_id', user!.id)
        .order('dream_date', { ascending: false })
      return (data ?? []) as Dream[]
    },
    enabled: !!user,
  })

  const { data: friendsCount = 0 } = useQuery({
    queryKey: ['my-friends-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
        .eq('status', 'accepted')
      return count ?? 0
    },
    enabled: !!user,
  })

  const lucidCount = useMemo(() => dreams.filter(d => d.is_lucid).length, [dreams])

  const monthlyData = useMemo(() => {
    const byMonth: Record<string, number> = {}
    dreams.forEach(d => {
      const month = d.dream_date.slice(0, 7)
      byMonth[month] = (byMonth[month] ?? 0) + 1
    })
    return Object.entries(byMonth)
      .sort()
      .slice(-12)
      .map(([month, count]) => {
        const [, m] = month.split('-')
        return { month: MONTH_LABELS[parseInt(m) - 1], total: count }
      })
  }, [dreams])

  const emotionData = useMemo(() => {
    const counts: Record<string, number> = {}
    dreams.forEach(d => d.emotions?.forEach(e => { counts[e] = (counts[e] ?? 0) + 1 }))
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({ name, value, color: EMOTION_COLORS[i % EMOTION_COLORS.length] }))
  }, [dreams])

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {}
    dreams.forEach(d => d.tags?.forEach(t => { counts[t] = (counts[t] ?? 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [dreams])

  const lucidRatio = dreams.length > 0 ? (lucidCount / dreams.length) * 100 : 0

  if (!user) return null

  return (
    <div className="flex flex-col min-h-svh">

      {/* Header */}
      <header
        className="sticky top-0 z-30 px-4 pb-3"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          background: 'rgba(8,8,20,0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">{user.name}</h1>
          <button
            onClick={() => navigate('/ajustes')}
            className="p-2 rounded-xl text-white/50 hover:text-white/80 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* Profile info */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-5 mb-4">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/10 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.6), rgba(var(--glass-tint),0.8))' }}>
            {user.avatar_url
              ? <img src={user.avatar_url} className="w-full h-full object-cover" alt={user.name} />
              : <div className="w-full h-full flex items-center justify-center text-3xl">
                  {user.avatar_emoji ?? '☽'}
                </div>
            }
          </div>

          {/* Stats row */}
          <div className="flex-1 flex justify-around">
            <button
              onClick={() => setTab('sueños')}
              className="flex flex-col items-center gap-0.5 min-w-[52px] active:opacity-70 transition-opacity"
            >
              <span className="text-xl font-bold text-white">{isLoading ? '–' : dreams.length}</span>
              <span className="text-[11px] text-white/40">sueños</span>
            </button>
            <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
              <span className="text-xl font-bold text-white">{lucidCount}</span>
              <span className="text-[11px] text-white/40">lúcidos</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
              <span className="text-xl font-bold text-white">{friendsCount}</span>
              <span className="text-[11px] text-white/40">amigos</span>
            </div>
          </div>
        </div>

        {/* Name + bio */}
        <div className="mb-3">
          <p className="font-semibold text-white text-sm">{user.name}</p>
          {user.user_number != null && (
            <p className="text-[11px] mt-0.5" style={{ color: `hsl(var(--accent-h), var(--accent-s), 60%)` }}>
              #{formatUserNumber(user.user_number)}
            </p>
          )}
          {user.bio && (
            <p className="text-[13px] text-white/50 mt-1.5 leading-snug">{user.bio}</p>
          )}
          {user.instagram_username && (
            <p className="text-[12px] mt-1" style={{ color: `hsl(var(--accent-h), var(--accent-s), 70%)` }}>
              @{user.instagram_username}
            </p>
          )}
        </div>

        {/* Edit button */}
        <button
          onClick={() => navigate('/ajustes')}
          className="w-full py-1.5 rounded-xl text-sm font-medium text-white/70 border border-white/12 hover:border-white/22 bg-white/5 hover:bg-white/8 transition-all active:scale-[0.98]"
        >
          Editar perfil
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8 mb-0.5">
        {(['sueños', 'estadísticas'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-all relative"
            style={{ color: tab === t ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.35)' }}
          >
            {t === 'sueños' ? <GridIcon size={13} /> : <ChartIcon size={13} />}
            <span className="capitalize">{t}</span>
            {tab === t && (
              <div
                className="absolute bottom-0 left-1/4 right-1/4 h-[2px] rounded-full"
                style={{ background: `hsl(var(--accent-h), var(--accent-s), 70%)` }}
              />
            )}
          </button>
        ))}
      </div>

      {tab === 'sueños' ? (
        <DreamsGrid dreams={dreams} isLoading={isLoading} />
      ) : (
        <StatsContent
          totalCount={dreams.length}
          lucidCount={lucidCount}
          lucidRatio={lucidRatio}
          monthlyData={monthlyData}
          emotionData={emotionData}
          topTags={topTags}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}

function DreamsGrid({ dreams, isLoading }: { dreams: Dream[]; isLoading: boolean }) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-0.5">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-square shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    )
  }

  if (dreams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <div className="text-5xl mb-4">🌙</div>
        <p className="text-white/50 text-sm">Aún no tienes sueños registrados</p>
        <p className="text-white/25 text-xs mt-1">Tus sueños aparecerán aquí</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-0.5">
      {dreams.map(dream => (
        <button
          key={dream.id}
          onClick={() => navigate(`/diario/${dream.id}`)}
          className="aspect-square relative overflow-hidden group"
          style={{ background: getGradient(dream.id) }}
        >
          {dream.is_lucid && (
            <div className="absolute top-1.5 right-1.5 z-10 text-[9px] text-white/70 bg-black/35 rounded-full px-1 py-0.5 backdrop-blur-sm leading-none">
              ✦
            </div>
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center px-1.5 pt-1 pb-4">
            {dream.title ? (
              <p className="text-[10px] text-white/85 text-center leading-tight line-clamp-3 font-medium">
                {dream.title}
              </p>
            ) : (
              <p className="text-[9px] text-white/50 text-center leading-tight line-clamp-3 italic">
                {dream.body.slice(0, 50)}
              </p>
            )}
          </div>

          <div className="absolute bottom-1 left-0 right-0 flex justify-center">
            <span className="text-[8px] text-white/30">
              {new Date(dream.dream_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
          </div>

          <div className="absolute inset-0 bg-white/0 group-active:bg-white/8 transition-colors" />
        </button>
      ))}
    </div>
  )
}

function StatsContent({
  totalCount, lucidCount, lucidRatio, monthlyData, emotionData, topTags, isLoading,
}: {
  totalCount: number
  lucidCount: number
  lucidRatio: number
  monthlyData: { month: string; total: number }[]
  emotionData: { name: string; value: number; color: string }[]
  topTags: [string, number][]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="glass-card h-32 shimmer" />)}
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { value: totalCount, label: 'Sueños', icon: '📓' },
          { value: lucidCount, label: 'Lúcidos', icon: '✨' },
          { value: `${lucidRatio.toFixed(0)}%`, label: 'Ratio', icon: '🔮' },
        ].map(({ value, label, icon }) => (
          <div key={label} className="glass-card p-3.5 text-center">
            <div className="text-xl mb-1">{icon}</div>
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: `hsl(var(--accent-h), var(--accent-s), 80%)` }}
            >
              {value}
            </div>
            <div className="text-[10px] text-white/35 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {monthlyData.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-medium text-white/40 mb-4">Sueños por mes</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthlyData} barSize={18} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#12121F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} fill={`hsl(var(--accent-h), var(--accent-s), 60%)`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {emotionData.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-medium text-white/40 mb-4">Emociones dominantes</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={emotionData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={3} dataKey="value">
                  {emotionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {emotionData.map(({ name, value, color }) => (
                <div key={name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[11px] text-white/60 capitalize">{name}</span>
                  </div>
                  <span className="text-[10px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {topTags.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-medium text-white/40 mb-3">Etiquetas más usadas</p>
          <div className="flex flex-wrap gap-1.5">
            {topTags.map(([tag, count]) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(var(--glow), 0.10)',
                  border: '1px solid rgba(var(--glow), 0.18)',
                  color: `hsl(var(--accent-h), var(--accent-s), 72%)`,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                #{tag} <span style={{ color: 'rgba(255,255,255,0.3)' }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function GridIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

function ChartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}
