import { useState, useRef, useEffect, useCallback } from 'react'
import type { Dream } from '../../types'

interface Props {
  dream: Dream
  authorName: string
  onClose: () => void
}

type TemplateId = 'cosmos' | 'nebula' | 'minimal' | 'aurora' | 'midnight'

const TEMPLATES: { id: TemplateId; name: string; bg: string; emoji: string }[] = [
  { id: 'cosmos',   name: 'Cosmos',     bg: 'linear-gradient(160deg,#0a0414,#1a0a3a)', emoji: '🌙' },
  { id: 'nebula',   name: 'Nebulosa',   bg: 'linear-gradient(160deg,#08011a,#3d0a5c)', emoji: '💜' },
  { id: 'minimal',  name: 'Minimal',    bg: 'linear-gradient(160deg,#000,#0d0d0d)',    emoji: '✦'  },
  { id: 'aurora',   name: 'Aurora',     bg: 'linear-gradient(160deg,#010a1a,#0a2020)', emoji: '🌌' },
  { id: 'midnight', name: 'Medianoche', bg: 'linear-gradient(160deg,#03071e,#08023a)', emoji: '🌕' },
]

const W = 1080, H = 1920

/* ── Canvas helpers ─────────────────────────────────────────────────────── */

function wrapText(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, maxW: number, lineH: number, maxLines = 999,
): number {
  const words = text.split(' ')
  let line = '', drawn = 0
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
      line = words[i] + ' '; drawn++
    } else { line = test }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, y + drawn * lineH)
  return y + (drawn + 1) * lineH
}

function seededRand(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function drawStars(ctx: CanvasRenderingContext2D, n: number, seed = 42) {
  const r = seededRand(seed)
  for (let i = 0; i < n; i++) {
    ctx.beginPath()
    ctx.arc(r() * W, r() * H, r() * 2.2 + 0.4, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.6 + 0.25})`
    ctx.fill()
  }
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

const FONT = '-apple-system, BlinkMacSystemFont, Arial, sans-serif'

function drawBrand(ctx: CanvasRenderingContext2D, color = 'rgba(255,255,255,0.35)') {
  ctx.font = `bold 40px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'
  ctx.fillText('BITÁCORA DEL SUEÑO', W / 2, 108)
}

function drawFooter(ctx: CanvasRenderingContext2D, authorName: string, dream: Dream, color = 'rgba(255,255,255,0.3)') {
  const d = new Date(dream.dream_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.font = `38px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'
  ctx.fillText(`${authorName}  ·  ${d}`, W / 2, H * 0.957)
}

function drawTags(ctx: CanvasRenderingContext2D, dream: Dream, y: number, color: string) {
  if (!dream.tags.length) return
  ctx.font = `44px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'
  ctx.fillText(dream.tags.slice(0, 4).map(t => `#${t}`).join('  '), W / 2, y)
}

function lucidBadge(ctx: CanvasRenderingContext2D, y: number, color: string): number {
  if (!ctx) return y
  ctx.font = `bold 42px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'
  ctx.fillText('✦ SUEÑO LÚCIDO', W / 2, y)
  return y + 72
}

/* ── Templates ──────────────────────────────────────────────────────────── */

function tCosmos(ctx: CanvasRenderingContext2D, dream: Dream, author: string) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#080416'); bg.addColorStop(0.5, '#12073a'); bg.addColorStop(1, '#050212')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  drawStars(ctx, 130)
  const g = ctx.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.36, 480)
  g.addColorStop(0, 'rgba(147,99,255,0.32)'); g.addColorStop(1, 'transparent')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  drawBrand(ctx)
  ctx.font = '230px serif'; ctx.textAlign = 'center'; ctx.fillText('🌙', W / 2, H * 0.325)
  ctx.font = `bold 86px ${FONT}`; ctx.fillStyle = '#fff'
  let y = wrapText(ctx, dream.title || '✨ Sueño', W / 2, H * 0.455, W - 130, 108, 2)
  const dv = ctx.createLinearGradient(W / 2 - 150, 0, W / 2 + 150, 0)
  dv.addColorStop(0, 'transparent'); dv.addColorStop(0.5, 'rgba(147,99,255,0.7)'); dv.addColorStop(1, 'transparent')
  ctx.strokeStyle = dv; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(W / 2 - 150, y + 20); ctx.lineTo(W / 2 + 150, y + 20); ctx.stroke()
  y += 70
  ctx.font = `52px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.62)'
  y = wrapText(ctx, dream.body, W / 2, y, W - 160, 72, 7)
  if (dream.is_lucid) y = lucidBadge(ctx, y + 50, 'rgba(147,99,255,0.9)')
  drawTags(ctx, dream, y + 30, 'rgba(147,99,255,0.85)')
  drawFooter(ctx, author, dream)
}

function tNebula(ctx: CanvasRenderingContext2D, dream: Dream, author: string) {
  ctx.fillStyle = '#08011a'; ctx.fillRect(0, 0, W, H)
  ;([[W*.15,H*.18,620,'rgba(100,20,180,0.4)'],[W*.88,H*.08,540,'rgba(200,40,120,0.3)'],
     [W*.5,H*.72,720,'rgba(30,100,200,0.23)'],[W*.75,H*.55,400,'rgba(160,20,200,0.18)']] as [number,number,number,string][])
    .forEach(([x,y,r,c]) => {
      const g = ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,c); g.addColorStop(1,'transparent')
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H)
    })
  drawStars(ctx, 90, 123)
  const cx = 80, cy = H * 0.21, cw = W - 160, ch = H * 0.6
  rrect(ctx, cx, cy, cw, ch, 80)
  ctx.fillStyle = 'rgba(255,255,255,0.055)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2.5; ctx.stroke()
  drawBrand(ctx, 'rgba(255,255,255,0.4)')
  ctx.strokeStyle = 'rgba(200,80,255,0.3)'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(cx + 80, cy + 110); ctx.lineTo(cx + cw - 80, cy + 110); ctx.stroke()
  ctx.font = `bold 78px ${FONT}`; ctx.fillStyle = '#fff'
  let y = wrapText(ctx, dream.title || '✨ Sueño', W / 2, cy + 185, cw - 120, 96, 2)
  if (dream.is_lucid) y = lucidBadge(ctx, y + 55, 'rgba(224,64,251,0.85)')
  ctx.font = `50px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'
  wrapText(ctx, dream.body, W / 2, y + 40, cw - 130, 68, 6)
  drawTags(ctx, dream, cy + ch + 75, 'rgba(200,100,255,0.85)')
  drawFooter(ctx, author, dream)
}

function tMinimal(ctx: CanvasRenderingContext2D, dream: Dream, author: string) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  const vg = ctx.createLinearGradient(0, H * .12, 0, H * .88)
  vg.addColorStop(0,'transparent'); vg.addColorStop(0.25,'#9363ff'); vg.addColorStop(0.75,'#9363ff'); vg.addColorStop(1,'transparent')
  ctx.strokeStyle = vg; ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(100, H * .12); ctx.lineTo(100, H * .88); ctx.stroke()
  ctx.font = `bold 38px ${FONT}`; ctx.fillStyle = 'rgba(147,99,255,0.7)'; ctx.textAlign = 'left'
  ctx.fillText('BITÁCORA DEL SUEÑO', 150, 138)
  const d = new Date(dream.dream_date).toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' })
  ctx.font = `38px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText(d, 150, 202)
  ctx.font = 'bold 320px serif'; ctx.fillStyle = 'rgba(147,99,255,0.07)'; ctx.textAlign = 'left'
  ctx.fillText('"', 60, H * .46)
  ctx.font = `bold 94px ${FONT}`; ctx.fillStyle = '#fff'
  let y = wrapText(ctx, dream.title || 'Sin título', 150, H * .32, W - 200, 114, 3)
  if (dream.is_lucid) {
    ctx.font = `bold 42px ${FONT}`; ctx.fillStyle = 'rgba(147,99,255,0.8)'
    ctx.fillText('✦ SUEÑO LÚCIDO', 150, y + 50); y += 110
  }
  ctx.font = `54px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.5)'
  y = wrapText(ctx, dream.body, 150, y + 40, W - 210, 74, 7)
  if (dream.tags.length) {
    ctx.font = `44px ${FONT}`; ctx.fillStyle = 'rgba(147,99,255,0.75)'
    ctx.fillText(dream.tags.slice(0,4).map(t=>`#${t}`).join('  '), 150, y + 70)
  }
  ctx.font = `bold 40px ${FONT}`; ctx.fillStyle = 'rgba(147,99,255,0.65)'
  ctx.fillText(author, 150, H * .957)
}

function tAurora(ctx: CanvasRenderingContext2D, dream: Dream, author: string) {
  ctx.fillStyle = '#010a1a'; ctx.fillRect(0, 0, W, H)
  const a1 = ctx.createLinearGradient(0,0,W,H*.55)
  a1.addColorStop(0,'rgba(0,200,120,0)'); a1.addColorStop(0.2,'rgba(0,200,120,0.13)')
  a1.addColorStop(0.38,'rgba(60,100,240,0.18)'); a1.addColorStop(0.55,'rgba(140,40,200,0.12)'); a1.addColorStop(0.75,'transparent')
  ctx.fillStyle = a1; ctx.fillRect(0,0,W,H)
  const a2 = ctx.createLinearGradient(W,0,0,H*.42)
  a2.addColorStop(0,'rgba(0,160,200,0)'); a2.addColorStop(0.3,'rgba(0,160,200,0.14)'); a2.addColorStop(0.55,'rgba(0,255,150,0.07)'); a2.addColorStop(1,'transparent')
  ctx.fillStyle = a2; ctx.fillRect(0,0,W,H)
  drawStars(ctx, 65, 77)
  drawBrand(ctx, 'rgba(255,255,255,0.4)')
  ctx.font = '110px serif'; ctx.fillStyle = 'rgba(0,200,150,0.25)'; ctx.textAlign = 'center'; ctx.fillText('✦', W/2-370, H*.28)
  ctx.font = '65px serif'; ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillText('✦', W/2+310, H*.23); ctx.fillText('✦', W/2+395, H*.35)
  const dg = ctx.createLinearGradient(120,0,W-120,0)
  dg.addColorStop(0,'transparent'); dg.addColorStop(0.5,'rgba(0,200,150,0.5)'); dg.addColorStop(1,'transparent')
  ctx.strokeStyle = dg; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(120, H*.39); ctx.lineTo(W-120, H*.39); ctx.stroke()
  ctx.font = `bold 84px ${FONT}`; ctx.fillStyle = '#fff'
  let y = wrapText(ctx, dream.title || '✨ Sueño', W/2, H*.415, W-140, 104, 2)
  if (dream.is_lucid) y = lucidBadge(ctx, y + 60, 'rgba(0,200,150,0.9)')
  ctx.font = `52px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.58)'
  wrapText(ctx, dream.body, W/2, y + 50, W-170, 70, 7)
  drawTags(ctx, dream, H*.878, 'rgba(0,200,150,0.85)')
  drawFooter(ctx, author, dream)
}

function tMidnight(ctx: CanvasRenderingContext2D, dream: Dream, author: string) {
  const bg = ctx.createLinearGradient(0,0,0,H)
  bg.addColorStop(0,'#03071e'); bg.addColorStop(1,'#08023a')
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H)
  drawStars(ctx, 110, 999)
  ctx.beginPath(); ctx.arc(W/2,H*.21,285,0,Math.PI*2)
  ctx.strokeStyle='rgba(255,215,80,0.1)'; ctx.lineWidth=48; ctx.stroke()
  ctx.strokeStyle='rgba(255,215,80,0.14)'; ctx.lineWidth=3; ctx.stroke()
  const h = ctx.createRadialGradient(W/2,H*.21,180,W/2,H*.21,520)
  h.addColorStop(0,'rgba(255,215,80,0.09)'); h.addColorStop(1,'transparent')
  ctx.fillStyle=h; ctx.fillRect(0,0,W,H)
  ctx.font='290px serif'; ctx.textAlign='center'; ctx.fillText('🌕',W/2,H*.315)
  drawBrand(ctx,'rgba(255,215,80,0.55)')
  const dg = ctx.createLinearGradient(W/2-160,0,W/2+160,0)
  dg.addColorStop(0,'transparent'); dg.addColorStop(0.5,'rgba(255,215,80,0.3)'); dg.addColorStop(1,'transparent')
  ctx.strokeStyle=dg; ctx.lineWidth=2.5
  ctx.beginPath(); ctx.moveTo(W/2-160,H*.415); ctx.lineTo(W/2+160,H*.415); ctx.stroke()
  let y = dream.is_lucid ? lucidBadge(ctx, H*.445, 'rgba(255,215,80,0.75)') : H*.445
  ctx.font=`bold 88px ${FONT}`; ctx.fillStyle='#fff'
  y = wrapText(ctx, dream.title||'✨ Sueño', W/2, y, W-140, 110, 2)
  ctx.font=`52px ${FONT}`; ctx.fillStyle='rgba(255,255,255,0.55)'
  wrapText(ctx, dream.body, W/2, y+55, W-170, 70, 7)
  drawTags(ctx, dream, H*.878, 'rgba(255,215,80,0.75)')
  drawFooter(ctx, author, dream, 'rgba(255,255,255,0.3)')
}

const DRAW: Record<TemplateId, (ctx: CanvasRenderingContext2D, d: Dream, a: string) => void> = {
  cosmos: tCosmos, nebula: tNebula, minimal: tMinimal, aurora: tAurora, midnight: tMidnight,
}

/* ── Component ─────────────────────────────────────────────────────────── */
export function ShareModal({ dream, authorName, onClose }: Props) {
  const [template, setTemplate] = useState<TemplateId>('cosmos')
  const [previewUrl, setPreviewUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const render = useCallback((tmpl: TemplateId) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    canvas.width = W; canvas.height = H
    DRAW[tmpl](ctx, dream, authorName)
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.93))
  }, [dream, authorName])

  useEffect(() => { render(template) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectTemplate(id: TemplateId) {
    setTemplate(id); render(id)
  }

  async function handleShare() {
    const canvas = canvasRef.current; if (!canvas) return
    setSharing(true)
    canvas.toBlob(async (blob) => {
      if (!blob) { setSharing(false); return }
      const file = new File([blob], 'sueno-bitacora.jpg', { type: 'image/jpeg' })
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: dream.title || 'Mi sueño — Bitácora del Sueño' })
        } else {
          // Desktop fallback: download
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = 'sueno-bitacora.jpg'; a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = 'sueno-bitacora.jpg'; a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      }
      setSharing(false)
    }, 'image/jpeg', 0.93)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-sm animate-scale-in flex flex-col gap-3">

        {/* Template picker */}
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              onClick={() => selectTemplate(tmpl.id)}
              className={`shrink-0 flex flex-col items-center gap-1.5 transition-all ${
                template === tmpl.id ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div
                className={`w-12 h-20 rounded-xl flex items-center justify-center text-xl ${
                  template === tmpl.id ? 'ring-2 ring-white/70' : 'ring-1 ring-white/15'
                }`}
                style={{ background: tmpl.bg }}
              >
                {tmpl.emoji}
              </div>
              <span className="text-[10px] text-white/50 font-medium">{tmpl.name}</span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div
          className="rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/10"
          style={{ aspectRatio: '9/16', maxHeight: '340px' }}
        >
          {previewUrl ? (
            <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/30">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="text-xs">Generando…</span>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-white/30 -mt-1">
          Imagen 1080×1920 · ideal para Stories de Instagram y WhatsApp
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-sm text-white/40 bg-white/6 hover:bg-white/10 border border-white/8 transition-all active:scale-95"
          >
            Cerrar
          </button>
          <button
            onClick={handleShare}
            disabled={sharing || !previewUrl}
            className="flex-1 glass-btn-primary py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sharing ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Compartiendo…</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>Compartir imagen</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
