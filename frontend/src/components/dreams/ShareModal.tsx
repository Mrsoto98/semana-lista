import { useState, useRef, useEffect, useCallback } from 'react'
import type { Dream } from '../../types'

interface Props {
  dream: Dream
  authorName: string
  onClose: () => void
}

type TemplateId = 'cosmos' | 'nebula' | 'minimal' | 'aurora' | 'midnight'

const TEMPLATES: { id: TemplateId; name: string; bg: string; accent: string }[] = [
  { id: 'cosmos',   name: 'Cosmos',      bg: 'linear-gradient(135deg,#0a0414,#1a0a3a)', accent: '#9363ff' },
  { id: 'nebula',   name: 'Nebulosa',    bg: 'linear-gradient(135deg,#08011a,#3d0a5c)', accent: '#e040fb' },
  { id: 'minimal',  name: 'Minimal',     bg: 'linear-gradient(135deg,#000,#111)',        accent: '#9363ff' },
  { id: 'aurora',   name: 'Aurora',      bg: 'linear-gradient(135deg,#010a1a,#0a2020)', accent: '#00c896' },
  { id: 'midnight', name: 'Medianoche',  bg: 'linear-gradient(135deg,#03071e,#08023a)', accent: '#ffd850' },
]

const W = 1080, H = 1920

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxW: number, lineH: number,
  maxLines = 999,
): number {
  const words = text.split(' ')
  let line = ''
  let drawn = 0
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' '
    if (ctx.measureText(test).width > maxW && i > 0) {
      if (drawn === maxLines - 1) {
        let s = line.trim()
        while (ctx.measureText(s + '…').width > maxW && s.length > 0) s = s.slice(0, -1)
        ctx.fillText(s + '…', x, y + drawn * lineH)
        return y + (drawn + 1) * lineH
      }
      ctx.fillText(line.trim(), x, y + drawn * lineH)
      line = words[i] + ' '
      drawn++
    } else {
      line = test
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, y + drawn * lineH)
  return y + (drawn + 1) * lineH
}

function rndSeeded(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function drawStars(ctx: CanvasRenderingContext2D, count: number, seed = 42) {
  const rnd = rndSeeded(seed)
  for (let i = 0; i < count; i++) {
    const r = rnd() * 2.2 + 0.4
    ctx.beginPath()
    ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.65 + 0.25})`
    ctx.fill()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function brand(ctx: CanvasRenderingContext2D, color = 'rgba(255,255,255,0.35)') {
  ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText('BITÁCORA DEL SUEÑO', W / 2, 108)
}

function footer(ctx: CanvasRenderingContext2D, authorName: string, dream: Dream, color = 'rgba(255,255,255,0.3)') {
  const dateStr = new Date(dream.dream_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.font = '38px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(`${authorName}  ·  ${dateStr}`, W / 2, H * 0.957)
}

function tags(ctx: CanvasRenderingContext2D, dream: Dream, y: number, color: string) {
  if (!dream.tags.length) return
  ctx.font = '44px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(dream.tags.slice(0, 4).map(t => `#${t}`).join('  '), W / 2, y)
}

// ── Template 1: Cosmos ──────────────────────────────────────────────────────
function drawCosmos(ctx: CanvasRenderingContext2D, dream: Dream, authorName: string) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#080416'); bg.addColorStop(0.5, '#12073a'); bg.addColorStop(1, '#050212')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  drawStars(ctx, 130)

  // Central glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.36, 480)
  glow.addColorStop(0, 'rgba(147,99,255,0.32)'); glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

  brand(ctx)

  // Moon
  ctx.font = '230px serif'
  ctx.textAlign = 'center'
  ctx.fillText('🌙', W / 2, H * 0.325)

  // Title
  ctx.font = 'bold 86px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = '#ffffff'
  const tEnd = wrapText(ctx, dream.title || '✨ Sueño', W / 2, H * 0.455, W - 130, 108, 2)

  // Divider
  const div = ctx.createLinearGradient(W / 2 - 150, 0, W / 2 + 150, 0)
  div.addColorStop(0, 'transparent'); div.addColorStop(0.5, 'rgba(147,99,255,0.7)'); div.addColorStop(1, 'transparent')
  ctx.strokeStyle = div; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(W / 2 - 150, tEnd + 20); ctx.lineTo(W / 2 + 150, tEnd + 20); ctx.stroke()

  // Body
  ctx.font = '52px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  const bEnd = wrapText(ctx, dream.body, W / 2, tEnd + 70, W - 160, 72, 7)

  if (dream.is_lucid) {
    ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    ctx.fillStyle = 'rgba(147,99,255,0.9)'
    ctx.fillText('✦ SUEÑO LÚCIDO', W / 2, bEnd + 50)
    tags(ctx, dream, bEnd + 120, 'rgba(147,99,255,0.85)')
  } else {
    tags(ctx, dream, bEnd + 60, 'rgba(147,99,255,0.85)')
  }

  footer(ctx, authorName, dream)
}

// ── Template 2: Nebulosa ────────────────────────────────────────────────────
function drawNebula(ctx: CanvasRenderingContext2D, dream: Dream, authorName: string) {
  ctx.fillStyle = '#08011a'; ctx.fillRect(0, 0, W, H)

  const blobs: [number, number, number, string][] = [
    [W * 0.15, H * 0.18, 620, 'rgba(100,20,180,0.38)'],
    [W * 0.88, H * 0.08, 540, 'rgba(200,40,120,0.3)'],
    [W * 0.5,  H * 0.72, 720, 'rgba(30,100,200,0.22)'],
    [W * 0.75, H * 0.55, 400, 'rgba(160,20,200,0.18)'],
  ]
  blobs.forEach(([x, y, r, c]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, c); g.addColorStop(1, 'transparent')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  })
  drawStars(ctx, 90, 123)

  // Glass card
  const cx = 80, cy = H * 0.21, cw = W - 160, ch = H * 0.6
  roundRect(ctx, cx, cy, cw, ch, 80)
  ctx.fillStyle = 'rgba(255,255,255,0.055)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2.5; ctx.stroke()

  brand(ctx, 'rgba(255,255,255,0.4)')

  ctx.strokeStyle = 'rgba(200,80,255,0.3)'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(cx + 80, cy + 110); ctx.lineTo(cx + cw - 80, cy + 110); ctx.stroke()

  ctx.font = 'bold 78px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = '#fff'
  const tEnd = wrapText(ctx, dream.title || '✨ Sueño', W / 2, cy + 185, cw - 120, 96, 2)

  if (dream.is_lucid) {
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    ctx.fillStyle = 'rgba(224,64,251,0.85)'
    ctx.fillText('✦ SUEÑO LÚCIDO', W / 2, tEnd + 55)
  }
  const bodyY = dream.is_lucid ? tEnd + 110 : tEnd + 45

  ctx.font = '50px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  wrapText(ctx, dream.body, W / 2, bodyY, cw - 130, 68, 6)

  tags(ctx, dream, cy + ch + 75, 'rgba(200,100,255,0.85)')
  footer(ctx, authorName, dream)
}

// ── Template 3: Minimal ─────────────────────────────────────────────────────
function drawMinimal(ctx: CanvasRenderingContext2D, dream: Dream, authorName: string) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)

  // Vertical accent line
  const vg = ctx.createLinearGradient(0, H * 0.12, 0, H * 0.88)
  vg.addColorStop(0, 'transparent'); vg.addColorStop(0.25, '#9363ff')
  vg.addColorStop(0.75, '#9363ff'); vg.addColorStop(1, 'transparent')
  ctx.strokeStyle = vg; ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(100, H * 0.12); ctx.lineTo(100, H * 0.88); ctx.stroke()

  ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(147,99,255,0.7)'; ctx.textAlign = 'left'
  ctx.fillText('BITÁCORA DEL SUEÑO', 150, 138)

  const dateStr = new Date(dream.dream_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.font = '38px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText(dateStr, 150, 202)

  // Big decorative quote
  ctx.font = 'bold 320px serif'
  ctx.fillStyle = 'rgba(147,99,255,0.07)'
  ctx.textAlign = 'left'
  ctx.fillText('"', 60, H * 0.46)

  ctx.font = 'bold 94px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = '#fff'
  const tEnd = wrapText(ctx, dream.title || 'Sin título', 150, H * 0.32, W - 200, 114, 3)

  if (dream.is_lucid) {
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    ctx.fillStyle = 'rgba(147,99,255,0.8)'
    ctx.fillText('✦ SUEÑO LÚCIDO', 150, tEnd + 50)
  }

  ctx.font = '54px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  const bodyY = dream.is_lucid ? tEnd + 110 : tEnd + 50
  const bEnd = wrapText(ctx, dream.body, 150, bodyY, W - 210, 74, 7)

  if (dream.tags.length) {
    ctx.font = '44px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    ctx.fillStyle = 'rgba(147,99,255,0.75)'
    ctx.fillText(dream.tags.slice(0, 4).map(t => `#${t}`).join('  '), 150, bEnd + 70)
  }

  ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(147,99,255,0.65)'
  ctx.fillText(authorName, 150, H * 0.957)
}

// ── Template 4: Aurora ──────────────────────────────────────────────────────
function drawAurora(ctx: CanvasRenderingContext2D, dream: Dream, authorName: string) {
  ctx.fillStyle = '#010a1a'; ctx.fillRect(0, 0, W, H)

  const a1 = ctx.createLinearGradient(0, 0, W, H * 0.55)
  a1.addColorStop(0, 'rgba(0,200,120,0)'); a1.addColorStop(0.2, 'rgba(0,200,120,0.13)')
  a1.addColorStop(0.38, 'rgba(60,100,240,0.18)'); a1.addColorStop(0.55, 'rgba(140,40,200,0.12)')
  a1.addColorStop(0.75, 'transparent')
  ctx.fillStyle = a1; ctx.fillRect(0, 0, W, H)

  const a2 = ctx.createLinearGradient(W, 0, 0, H * 0.42)
  a2.addColorStop(0, 'rgba(0,160,200,0)'); a2.addColorStop(0.3, 'rgba(0,160,200,0.14)')
  a2.addColorStop(0.55, 'rgba(0,255,150,0.07)'); a2.addColorStop(1, 'transparent')
  ctx.fillStyle = a2; ctx.fillRect(0, 0, W, H)

  drawStars(ctx, 65, 77)

  brand(ctx, 'rgba(255,255,255,0.4)')

  // Star accents
  ctx.font = '110px serif'; ctx.fillStyle = 'rgba(0,200,150,0.25)'; ctx.textAlign = 'center'
  ctx.fillText('✦', W / 2 - 370, H * 0.28)
  ctx.font = '65px serif'; ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillText('✦', W / 2 + 310, H * 0.23)
  ctx.fillText('✦', W / 2 + 395, H * 0.35)

  // Teal divider
  const dg = ctx.createLinearGradient(120, 0, W - 120, 0)
  dg.addColorStop(0, 'transparent'); dg.addColorStop(0.5, 'rgba(0,200,150,0.5)'); dg.addColorStop(1, 'transparent')
  ctx.strokeStyle = dg; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(120, H * 0.39); ctx.lineTo(W - 120, H * 0.39); ctx.stroke()

  ctx.font = 'bold 84px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = '#fff'
  const tEnd = wrapText(ctx, dream.title || '✨ Sueño', W / 2, H * 0.415, W - 140, 104, 2)

  if (dream.is_lucid) {
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    ctx.fillStyle = 'rgba(0,200,150,0.9)'
    ctx.fillText('✦ SUEÑO LÚCIDO', W / 2, tEnd + 60)
  }

  ctx.font = '52px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.58)'
  const bodyY = dream.is_lucid ? tEnd + 120 : tEnd + 55
  wrapText(ctx, dream.body, W / 2, bodyY, W - 170, 70, 7)

  tags(ctx, dream, H * 0.878, 'rgba(0,200,150,0.85)')
  footer(ctx, authorName, dream)
}

// ── Template 5: Medianoche ──────────────────────────────────────────────────
function drawMidnight(ctx: CanvasRenderingContext2D, dream: Dream, authorName: string) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#03071e'); bg.addColorStop(1, '#08023a')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  drawStars(ctx, 110, 999)

  // Moon ring decoration
  ctx.beginPath()
  ctx.arc(W / 2, H * 0.21, 285, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,215,80,0.1)'; ctx.lineWidth = 48; ctx.stroke()
  ctx.strokeStyle = 'rgba(255,215,80,0.14)'; ctx.lineWidth = 3; ctx.stroke()

  const halo = ctx.createRadialGradient(W / 2, H * 0.21, 180, W / 2, H * 0.21, 520)
  halo.addColorStop(0, 'rgba(255,215,80,0.09)'); halo.addColorStop(1, 'transparent')
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H)

  ctx.font = '290px serif'; ctx.textAlign = 'center'
  ctx.fillText('🌕', W / 2, H * 0.315)

  brand(ctx, 'rgba(255,215,80,0.55)')

  const dg = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0)
  dg.addColorStop(0, 'transparent'); dg.addColorStop(0.5, 'rgba(255,215,80,0.3)'); dg.addColorStop(1, 'transparent')
  ctx.strokeStyle = dg; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(W / 2 - 160, H * 0.415); ctx.lineTo(W / 2 + 160, H * 0.415); ctx.stroke()

  if (dream.is_lucid) {
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,215,80,0.75)'
    ctx.fillText('✦ SUEÑO LÚCIDO', W / 2, H * 0.445)
  }

  ctx.font = 'bold 88px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = '#fff'
  const titleY = dream.is_lucid ? H * 0.475 : H * 0.445
  const tEnd = wrapText(ctx, dream.title || '✨ Sueño', W / 2, titleY, W - 140, 110, 2)

  ctx.font = '52px -apple-system, BlinkMacSystemFont, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  wrapText(ctx, dream.body, W / 2, tEnd + 55, W - 170, 70, 7)

  tags(ctx, dream, H * 0.878, 'rgba(255,215,80,0.75)')
  footer(ctx, authorName, dream, 'rgba(255,255,255,0.3)')
}

const DRAW_FNS: Record<TemplateId, (ctx: CanvasRenderingContext2D, dream: Dream, a: string) => void> = {
  cosmos: drawCosmos,
  nebula: drawNebula,
  minimal: drawMinimal,
  aurora: drawAurora,
  midnight: drawMidnight,
}

// ── Component ───────────────────────────────────────────────────────────────
export function ShareModal({ dream, authorName, onClose }: Props) {
  const [tab, setTab] = useState<'text' | 'image'>('text')
  const [template, setTemplate] = useState<TemplateId>('cosmos')
  const [previewUrl, setPreviewUrl] = useState('')
  const [rendering, setRendering] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [textShared, setTextShared] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setRendering(true)
    canvas.width = W
    canvas.height = H
    DRAW_FNS[template](ctx, dream, authorName)
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.93))
    setRendering(false)
  }, [template, dream, authorName])

  useEffect(() => {
    if (tab === 'image') renderCanvas()
  }, [tab, renderCanvas])

  const shareText = [
    dream.title ? `"${dream.title}"` : '✨ Mi sueño',
    '',
    dream.body.slice(0, 280) + (dream.body.length > 280 ? '…' : ''),
    '',
    dream.is_lucid ? '✦ Sueño lúcido' : '',
    '',
    '— Bitácora del Sueño',
  ].filter(l => l !== undefined).join('\n')

  async function handleShareText() {
    if (navigator.share) {
      try {
        await navigator.share({ title: dream.title || 'Mi sueño', text: shareText })
        setTextShared(true); setTimeout(() => setTextShared(false), 2000)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') copyText()
      }
    } else copyText()
  }

  function copyText() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleShareImage() {
    const canvas = canvasRef.current
    if (!canvas) return
    setSharing(true)
    canvas.toBlob(async (blob) => {
      if (!blob) { setSharing(false); return }
      const file = new File([blob], 'sueno-bitacora.jpg', { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: dream.title || 'Mi sueño' })
        } catch (e) {
          if ((e as Error).name !== 'AbortError') downloadImage(blob)
        }
      } else {
        downloadImage(blob)
      }
      setSharing(false)
    }, 'image/jpeg', 0.93)
  }

  function downloadImage(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'sueno-bitacora.jpg'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const dateStr = new Date(dream.dream_date).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(14px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Hidden full-res canvas */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-sm animate-scale-in flex flex-col gap-3">

        {/* Tabs */}
        <div className="flex rounded-xl bg-white/6 border border-white/8 p-1 gap-1">
          {(['text', 'image'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t ? 'glass-nav-active text-white' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {t === 'text' ? '📝 Texto' : '🎨 Imagen'}
            </button>
          ))}
        </div>

        {tab === 'text' && (
          <>
            {/* Text preview card */}
            <div
              className="relative overflow-hidden rounded-3xl p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--glass-tint),0.22) 0%, rgba(var(--bg-deep),0.95) 100%)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: '0 20px 70px rgba(var(--glow-color),0.3), inset 0 1px 0 rgba(255,255,255,0.14)',
              }}
            >
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(var(--glow-color),0.22) 0%, transparent 70%)', filter: 'blur(28px)' }} />
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <span className="text-lg animate-float inline-block">🌙</span>
                <div>
                  <p className="text-[11px] font-bold text-white/70 tracking-wide">BITÁCORA DEL SUEÑO</p>
                  <p className="text-[9px] text-white/30">{authorName}</p>
                </div>
                {dream.is_lucid && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(var(--glow-color),0.22)', border: '1px solid rgba(var(--glow-color),0.4)', color: `rgb(var(--glow-color))` }}>
                    ✦ LÚCIDO
                  </span>
                )}
              </div>
              <div className="relative z-10">
                {dream.title && <h3 className="text-white font-bold text-base leading-snug mb-2">{dream.title}</h3>}
                <p className="text-white/62 text-sm leading-relaxed line-clamp-5">{dream.body}</p>
              </div>
              {dream.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 relative z-10">
                  {dream.tags.slice(0, 4).map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full accent-text"
                      style={{ background: 'rgba(var(--glow-color),0.12)', border: '1px solid rgba(var(--glow-color),0.2)' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8 relative z-10">
                <span className="text-[10px] text-white/25">{dateStr}</span>
                <span className="text-[9px] text-white/18 italic">Bitácora del Sueño</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/6 hover:bg-white/10 border border-white/8 transition-all active:scale-95">
                Cerrar
              </button>
              <button onClick={handleShareText}
                className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95 flex items-center justify-center gap-2">
                {textShared ? (<><CheckIcon />¡Compartido!</>) : copied ? (<><CheckIcon />Copiado</>) : (
                  <><ShareIcon />Compartir</>
                )}
              </button>
            </div>
          </>
        )}

        {tab === 'image' && (
          <>
            {/* Template picker */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {TEMPLATES.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => { setTemplate(tmpl.id); renderCanvas() }}
                  className={`shrink-0 flex flex-col items-center gap-1.5 transition-all ${
                    template === tmpl.id ? 'opacity-100 scale-105' : 'opacity-55 hover:opacity-80'
                  }`}
                >
                  <div
                    className={`w-14 h-24 rounded-xl overflow-hidden ${
                      template === tmpl.id ? 'ring-2 ring-white/60' : 'ring-1 ring-white/15'
                    }`}
                    style={{ background: tmpl.bg }}
                  >
                    {/* Mini decoration per template */}
                    <div className="w-full h-full flex items-center justify-center text-xl"
                      style={{ textShadow: `0 0 12px ${tmpl.accent}` }}>
                      {tmpl.id === 'cosmos' ? '🌙' : tmpl.id === 'nebula' ? '💜' :
                       tmpl.id === 'minimal' ? '✦' : tmpl.id === 'aurora' ? '🌌' : '🌕'}
                    </div>
                  </div>
                  <span className="text-[10px] text-white/50 font-medium">{tmpl.name}</span>
                </button>
              ))}
            </div>

            {/* Canvas preview */}
            <div className="rounded-2xl overflow-hidden border border-white/12 bg-black/40 flex items-center justify-center"
              style={{ aspectRatio: '9/16', maxHeight: '300px' }}>
              {rendering || !previewUrl ? (
                <div className="flex flex-col items-center gap-2 text-white/30">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  <span className="text-xs">Generando…</span>
                </div>
              ) : (
                <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" />
              )}
            </div>

            <p className="text-center text-[11px] text-white/30">
              Imagen 1080×1920 · lista para Instagram Stories
            </p>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/6 hover:bg-white/10 border border-white/8 transition-all active:scale-95">
                Cerrar
              </button>
              <button
                onClick={handleShareImage}
                disabled={sharing || !previewUrl}
                className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sharing ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Compartiendo…</>
                ) : (
                  <><ShareIcon />Compartir imagen</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}
