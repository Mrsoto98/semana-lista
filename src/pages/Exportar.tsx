import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { recuperar } from '../lib/storage'
import { useListasCompartidas } from '../hooks/useListaCompartida'
import { useI18n } from '../hooks/useI18n'
import type { MenuSemanal, Receta } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS, type ClaveMenu } from '../types'

// ── Instagram Stories generator ───────────────────────────────────────────────

type StoriesTheme = {
  id: string; name: string; emoji: string
  swatch: [string, string]   // gradient preview
  bg: [string, string, string]
  glowColor: string
  leafColor: string
  accent: string             // day label, bar, dots
  accentMuted: string        // separators, lines
  text: string               // main recipe names
  subtext: string            // COMIDA/CENA labels
  appName: string            // "SEMANA LISTA"
  cardBg: string; cardBorder: string
}

const STORIES_THEMES: StoriesTheme[] = [
  {
    id: 'gym', name: 'Power', emoji: '💪',
    swatch: ['#060609', '#0f0f1a'],
    bg: ['#040407', '#09090f', '#0f0f1a'],
    glowColor: 'rgba(212,255,0,0.07)',
    leafColor: '#d4ff00',
    accent: '#d4ff00', accentMuted: 'rgba(212,255,0,0.18)',
    text: '#ffffff', subtext: 'rgba(255,255,255,0.42)',
    appName: 'rgba(212,255,0,0.80)',
    cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(212,255,0,0.18)',
  },
  {
    id: 'terracota', name: 'Terracota', emoji: '🪴',
    swatch: ['#1e0e08', '#5c2d1a'],
    bg: ['#1a0b06', '#3a1a0c', '#5c2a18'],
    glowColor: 'rgba(220,130,80,0.10)',
    leafColor: '#a05030',
    accent: '#e8956a', accentMuted: 'rgba(220,150,100,0.22)',
    text: '#fdf4ec', subtext: 'rgba(253,244,236,0.42)',
    appName: 'rgba(230,170,120,0.68)',
    cardBg: 'rgba(255,255,255,0.058)', cardBorder: 'rgba(220,160,110,0.10)',
  },
  {
    id: 'medianoche', name: 'Medianoche', emoji: '🌙',
    swatch: ['#07071a', '#1a1a3e'],
    bg: ['#06060f', '#0e0e28', '#181840'],
    glowColor: 'rgba(120,120,240,0.10)',
    leafColor: '#3a3a90',
    accent: '#9b9bf0', accentMuted: 'rgba(150,150,240,0.22)',
    text: '#f0f0ff', subtext: 'rgba(240,240,255,0.42)',
    appName: 'rgba(170,170,255,0.68)',
    cardBg: 'rgba(255,255,255,0.055)', cardBorder: 'rgba(150,150,255,0.10)',
  },
  {
    id: 'rosa', name: 'Rosa', emoji: '🌸',
    swatch: ['#130509', '#3a1424'],
    bg: ['#100406', '#261020', '#3a1630'],
    glowColor: 'rgba(220,80,150,0.10)',
    leafColor: '#8b2560',
    accent: '#e88ab0', accentMuted: 'rgba(220,130,180,0.22)',
    text: '#fdf0f6', subtext: 'rgba(253,240,246,0.42)',
    appName: 'rgba(240,160,200,0.68)',
    cardBg: 'rgba(255,255,255,0.055)', cardBorder: 'rgba(220,130,180,0.10)',
  },
  {
    id: 'carbon', name: 'Dorado', emoji: '✨',
    swatch: ['#080808', '#1c1408'],
    bg: ['#080808', '#111008', '#1c1a08'],
    glowColor: 'rgba(210,175,50,0.08)',
    leafColor: '#6e5a18',
    accent: '#e8c84a', accentMuted: 'rgba(210,180,60,0.22)',
    text: '#f8f4e8', subtext: 'rgba(248,244,232,0.42)',
    appName: 'rgba(220,185,70,0.68)',
    cardBg: 'rgba(255,255,255,0.045)', cardBorder: 'rgba(210,175,50,0.12)',
  },
]

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function clamp(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 0 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

// ── Per-theme decorations ─────────────────────────────────────────────────────


function decoArches(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  // Mediterranean arched windows at bottom + top decorative tiles
  ctx.save()
  ctx.strokeStyle = color; ctx.lineWidth = 3
  const arch = (cx: number, baseY: number, aw: number, ah: number, a: number) => {
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.moveTo(cx - aw / 2, baseY)
    ctx.lineTo(cx - aw / 2, baseY - ah + aw / 2)
    ctx.arc(cx, baseY - ah + aw / 2, aw / 2, Math.PI, 0)
    ctx.lineTo(cx + aw / 2, baseY)
    ctx.stroke()
  }
  // Large arches at bottom
  arch(W * 0.2, H + 20, 280, 460, 0.18)
  arch(W * 0.5, H + 20, 320, 520, 0.22)
  arch(W * 0.8, H + 20, 280, 440, 0.16)
  // Smaller arches at top
  arch(W * 0.15, 560, 140, 220, 0.10)
  arch(W * 0.85, 540, 140, 210, 0.10)
  // Small decorative tile dots grid at header area
  ctx.globalAlpha = 0.12
  ctx.fillStyle = color
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      ctx.beginPath()
      ctx.arc(col * 190 + 55, row * 30 + H - 140, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function decoStars(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  // Starfield + crescent moon
  ctx.save()
  const rng = (seed: number) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x) }
  for (let i = 0; i < 90; i++) {
    const x = rng(i * 3.1) * W
    const y = rng(i * 7.3) * H * 0.75
    const r = rng(i * 2.7) * 2.2 + 0.4
    ctx.globalAlpha = rng(i * 5.1) * 0.55 + 0.15
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = 'white'; ctx.fill()
  }
  // A few larger star sparkles
  for (let i = 0; i < 8; i++) {
    const x = rng(i * 11.3 + 1) * W
    const y = rng(i * 4.7 + 2) * H * 0.5
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = 'white'; ctx.lineWidth = 1
    const s = 5
    ctx.beginPath()
    ctx.moveTo(x - s, y); ctx.lineTo(x + s, y)
    ctx.moveTo(x, y - s); ctx.lineTo(x, y + s)
    ctx.stroke()
  }
  // Crescent moon top right
  ctx.globalAlpha = 0.14
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(W - 140, 220, 110, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#07071a'
  ctx.beginPath(); ctx.arc(W - 96, 196, 104, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function decoPetals(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  // Soft watercolor petal circles
  ctx.save()
  const petals = [
    [W * 0.08, H * 0.07, 300, 0.13], [W * 0.92, H * 0.04, 240, 0.11],
    [W * 0.04, H * 0.5, 220, 0.09], [W * 0.96, H * 0.42, 260, 0.10],
    [W * 0.5, H * 0.12, 180, 0.09], [W * 0.18, H * 0.88, 200, 0.08],
    [W * 0.82, H * 0.86, 190, 0.08],
  ]
  for (const [px, py, pr, a] of petals) {
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr)
    g.addColorStop(0, color.replace('rgb(', 'rgba(').replace(')', `, ${(a as number) * 2})`))
    g.addColorStop(0.5, color.replace('rgb(', 'rgba(').replace(')', `, ${a as number})`))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
  }
  // Thin petal outlines
  ctx.globalAlpha = 0.08; ctx.strokeStyle = color; ctx.lineWidth = 1.5
  const drawPetal = (cx: number, cy: number, r: number, rot: number) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(0, 0); ctx.bezierCurveTo(-r * 0.4, -r * 0.6, -r * 0.15, -r, 0, -r * 1.1)
    ctx.bezierCurveTo(r * 0.15, -r, r * 0.4, -r * 0.6, 0, 0)
    ctx.stroke(); ctx.restore()
  }
  for (let i = 0; i < 8; i++) drawPetal(W * 0.08, H * 0.07, 120, (i * Math.PI) / 4)
  for (let i = 0; i < 6; i++) drawPetal(W * 0.92, H * 0.86, 90, (i * Math.PI) / 3)
  ctx.restore()
}

function decoArtDeco(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  ctx.save()
  // Sun rays from top center
  ctx.strokeStyle = color; ctx.lineWidth = 1
  const cx = W / 2, cy = -300
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2
    ctx.globalAlpha = 0.07
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * 200, cy + Math.sin(angle) * 200)
    ctx.lineTo(cx + Math.cos(angle) * H * 1.6, cy + Math.sin(angle) * H * 1.6)
    ctx.stroke()
  }
  // Double border frame
  ctx.globalAlpha = 0.13; ctx.lineWidth = 2
  const m1 = 30, m2 = 44
  ctx.strokeRect(m1, m1, W - m1 * 2, H - m1 * 2)
  ctx.strokeRect(m2, m2, W - m2 * 2, H - m2 * 2)
  // Corner ornaments
  ctx.globalAlpha = 0.18; ctx.lineWidth = 2
  const co = (x: number, y: number, fx: number, fy: number) => {
    ctx.beginPath()
    ctx.moveTo(x + fx * 80, y); ctx.lineTo(x, y); ctx.lineTo(x, y + fy * 80); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + fx * 50, y + fy * 12); ctx.lineTo(x + fx * 12, y + fy * 12)
    ctx.lineTo(x + fx * 12, y + fy * 50); ctx.stroke()
  }
  co(m2, m2, 1, 1); co(W - m2, m2, -1, 1); co(m2, H - m2, 1, -1); co(W - m2, H - m2, -1, -1)
  // Chevron strips at top and bottom
  ctx.globalAlpha = 0.10; ctx.lineWidth = 1.5
  for (let i = 0; i < 5; i++) {
    const yy = 90 + i * 14
    ctx.beginPath(); ctx.moveTo(W * 0.25, yy); ctx.lineTo(W / 2, yy - 10); ctx.lineTo(W * 0.75, yy); ctx.stroke()
  }
  ctx.restore()
}

function decoGym(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  ctx.save()
  // Hexagon grid full canvas
  ctx.strokeStyle = color; ctx.lineWidth = 1
  const R = 48, hW = R * Math.sqrt(3)
  for (let row = -1; row < H / (R * 1.5) + 2; row++) {
    for (let col = -1; col < W / hW + 2; col++) {
      ctx.globalAlpha = 0.052
      const cx = col * hW + (row % 2) * (hW / 2)
      const cy = row * R * 1.5
      ctx.beginPath()
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3
        j === 0 ? ctx.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a))
                : ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a))
      }
      ctx.closePath(); ctx.stroke()
    }
  }
  // Diagonal speed lines right side
  ctx.lineWidth = 2.5
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = 0.07 + i * 0.012
    const x = W * 0.55 + i * 90
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 440, H); ctx.stroke()
  }
  // Bold neon left bar
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 6, H)
  // Neon top bar
  ctx.fillRect(0, 0, W, 4)
  // Neon bottom bar
  ctx.fillRect(0, H - 4, W, 4)
  // Small corner accent squares
  ctx.globalAlpha = 0.6
  ctx.fillRect(6, 6, 40, 6); ctx.fillRect(6, 6, 6, 40)
  ctx.fillRect(W - 46, 6, 40, 6); ctx.fillRect(W - 12, 6, 6, 40)
  ctx.fillRect(6, H - 12, 40, 6); ctx.fillRect(6, H - 46, 6, 40)
  ctx.fillRect(W - 46, H - 12, 40, 6); ctx.fillRect(W - 12, H - 46, 6, 40)
  ctx.restore()
}

function drawDecoration(ctx: CanvasRenderingContext2D, W: number, H: number, theme: StoriesTheme) {
  if (theme.id === 'gym')        decoGym(ctx, W, H, theme.accent)
  else if (theme.id === 'terracota') decoArches(ctx, W, H, theme.leafColor)
  else if (theme.id === 'medianoche') decoStars(ctx, W, H, theme.accent)
  else if (theme.id === 'rosa')  decoPetals(ctx, W, H, theme.leafColor)
  else if (theme.id === 'carbon') decoArtDeco(ctx, W, H, theme.accent)
}

async function generarStoriesBlob(menu: MenuSemanal, theme: StoriesTheme): Promise<Blob> {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background — each theme has its own gradient direction
  let bg: CanvasGradient
  if (theme.id === 'terracota') {
    bg = ctx.createLinearGradient(0, 0, 0, H)           // vertical warm
  } else if (theme.id === 'medianoche') {
    bg = ctx.createLinearGradient(W / 2, 0, W / 2, H)   // straight vertical
  } else if (theme.id === 'rosa') {
    bg = ctx.createLinearGradient(0, 0, W, H)            // diagonal
  } else if (theme.id === 'carbon') {
    bg = ctx.createLinearGradient(W / 2, 0, W / 2, H)   // vertical dark
  } else {
    bg = ctx.createLinearGradient(0, 0, W * 0.3, H)     // bosque diagonal
  }
  bg.addColorStop(0, theme.bg[0])
  bg.addColorStop(0.45, theme.bg[1])
  bg.addColorStop(1, theme.bg[2])
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Glow — positioned differently per theme
  const glowY = theme.id === 'rosa' ? H * 0.3 : 0
  const glow = ctx.createRadialGradient(W / 2, glowY, 0, W / 2, glowY, 700)
  glow.addColorStop(0, theme.glowColor)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Theme-specific decoration
  drawDecoration(ctx, W, H, theme)

  // ── Header ──
  ctx.textAlign = 'center'

  // App icon + name row
  ctx.font = '500 32px system-ui, sans-serif'
  ctx.fillStyle = theme.appName
  ctx.fillText('🍽  SEMANA LISTA', W / 2, 118)

  // Tagline
  ctx.font = '300 26px system-ui, sans-serif'
  ctx.fillStyle = theme.subtext
  ctx.fillText('Planificador de menú semanal con IA', W / 2, 158)

  // Decorative lines helper
  const drawLine = (y: number, half = 200) => {
    ctx.strokeStyle = theme.accentMuted; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(W / 2 - half, y); ctx.lineTo(W / 2 + half, y); ctx.stroke()
  }
  drawLine(182, 280)

  // Main title
  ctx.font = 'bold 108px Georgia, "Times New Roman", serif'
  ctx.fillStyle = theme.text
  ctx.fillText('MI MENÚ', W / 2, 300)

  ctx.font = '300 54px Georgia, "Times New Roman", serif'
  ctx.fillStyle = theme.subtext
  ctx.fillText('DE LA SEMANA', W / 2, 372)

  drawLine(400, 160)

  // ── Day cards ──
  const diasConRecetas = DIAS.filter(d => menu[`${d}_comida`] || menu[`${d}_cena`])
  const n = diasConRecetas.length
  const CARD_TOP = 444
  const CARD_GAP = 18
  const FOOTER_H = 160
  const CARD_H = Math.floor((H - CARD_TOP - FOOTER_H - CARD_GAP * (n - 1)) / n)
  const CARD_W = W - 80
  const CX = 40

  diasConRecetas.forEach((dia, i) => {
    const comida = menu[`${dia}_comida`]
    const cena = menu[`${dia}_cena`]
    const cardY = CARD_TOP + i * (CARD_H + CARD_GAP)

    // Card bg
    ctx.fillStyle = theme.cardBg
    rrect(ctx, CX, cardY, CARD_W, CARD_H, 28)
    ctx.fill()

    // Card border
    ctx.strokeStyle = theme.cardBorder
    ctx.lineWidth = 1.5
    rrect(ctx, CX, cardY, CARD_W, CARD_H, 28)
    ctx.stroke()

    // Left accent bar
    ctx.fillStyle = theme.accent
    rrect(ctx, CX, cardY + 22, 5, CARD_H - 44, 3)
    ctx.fill()

    // Day name
    ctx.textAlign = 'left'
    ctx.font = 'bold 30px system-ui, sans-serif'
    ctx.fillStyle = theme.accent
    ctx.fillText(DIAS_LABEL[dia].toUpperCase(), CX + 44, cardY + 52)

    // Separator
    ctx.strokeStyle = theme.accentMuted
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(CX + 44, cardY + 66)
    ctx.lineTo(CX + CARD_W - 44, cardY + 66)
    ctx.stroke()

    const hasBoth = !!(comida && cena)
    const singleOffset = hasBoth ? 0 : 28

    if (comida) {
      ctx.font = '400 24px system-ui, sans-serif'
      ctx.fillStyle = theme.subtext
      ctx.fillText('☀  COMIDA', CX + 44, cardY + 98 + singleOffset)
      ctx.font = `600 ${Math.min(hasBoth ? 36 : 42, Math.floor(CARD_H * (hasBoth ? 0.19 : 0.22)))}px Georgia, serif`
      ctx.fillStyle = theme.text
      ctx.fillText(clamp(ctx, comida.nombre, CARD_W - 100), CX + 44, cardY + 140 + singleOffset)
    }

    if (cena) {
      const cenaY = hasBoth ? cardY + CARD_H / 2 + 14 : cardY + 98
      ctx.font = '400 24px system-ui, sans-serif'
      ctx.fillStyle = theme.subtext
      ctx.fillText('☾  CENA', CX + 44, cenaY)
      ctx.font = `600 ${Math.min(hasBoth ? 36 : 42, Math.floor(CARD_H * (hasBoth ? 0.19 : 0.22)))}px Georgia, serif`
      ctx.fillStyle = theme.text
      ctx.fillText(clamp(ctx, cena.nombre, CARD_W - 100), CX + 44, cenaY + 40)
    }
  })

  // ── Footer ──
  const FY = H - FOOTER_H + 20
  ctx.textAlign = 'center'
  drawLine(FY, 100)
  ctx.font = '400 26px system-ui, sans-serif'
  ctx.fillStyle = theme.appName
  ctx.fillText('🍽  Semana Lista  ·  Tu menú con IA', W / 2, FY + 52)

  for (let d = 0; d < 5; d++) {
    ctx.beginPath()
    ctx.arc(W / 2 - 40 + d * 20, FY + 84, 3, 0, Math.PI * 2)
    ctx.fillStyle = d === 2 ? theme.accent : theme.accentMuted
    ctx.fill()
  }

  return new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
}

type ItemLista = { nombre: string; cantidad?: number; unidad?: string; precio?: number; comprado?: boolean }

// ── helpers ───────────────────────────────────────────────────────────────────

function buildMenuTexto(menu: MenuSemanal): string {
  let t = '🥗 MI MENÚ SEMANAL — Semana Lista\n'
  t += '─'.repeat(36) + '\n\n'
  for (const dia of DIAS) {
    const bloques: string[] = []
    for (const franja of FRANJAS) {
      const r = menu[`${dia}_${franja}`]
      if (!r) continue
      const icono = franja === 'comida' ? '🍽️ COMIDA' : '🌙 CENA'
      let bloque = `  ${icono}: ${r.nombre}\n`
      bloque += `  ⏱ ${r.tiempo_prep} min · ${r.dificultad} · ~${r.calorias_aprox} kcal\n`
      if (r.descripcion_corta) bloque += `  ${r.descripcion_corta}\n`
      if (r.ingredientes?.length) {
        bloque += `  Ingredientes:\n`
        r.ingredientes.forEach(ing => {
          bloque += `    · ${ing.cantidad} ${ing.unidad} ${ing.nombre}\n`
        })
      }
      bloques.push(bloque)
    }
    if (bloques.length) {
      t += `📅 ${DIAS_LABEL[dia].toUpperCase()}\n${bloques.join('\n')}\n`
    }
  }
  return t.trim()
}

function buildListaTexto(items: ItemLista[], titulo: string): string {
  let t = `🛒 ${titulo.toUpperCase()} — Semana Lista\n`
  t += '─'.repeat(36) + '\n\n'
  const pendientes = items.filter(i => !i.comprado)
  const comprados = items.filter(i => i.comprado)
  if (pendientes.length) {
    pendientes.forEach(i => {
      const cant = i.cantidad ? `${i.cantidad}${i.unidad ? ' ' + i.unidad : ''}` : ''
      const precio = i.precio ? ` — ${i.precio.toFixed(2)} €` : ''
      t += `☐ ${i.nombre}${cant ? ' × ' + cant : ''}${precio}\n`
    })
  }
  if (comprados.length) {
    t += `\n✅ Ya comprado:\n`
    comprados.forEach(i => { t += `  ✓ ${i.nombre}\n` })
  }
  return t.trim()
}

async function copiar(texto: string, setCopied: (v: boolean) => void) {
  await navigator.clipboard.writeText(texto)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

function MenuPreview({ menu, t }: { menu: MenuSemanal; t: ReturnType<typeof useI18n>['t'] }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const toggle = (dia: string) => setAbiertos(p => ({ ...p, [dia]: !p[dia] }))

  return (
    <div className="space-y-2">
      {DIAS.map(dia => {
        const comida = menu[`${dia}_comida`]
        const cena = menu[`${dia}_cena`]
        if (!comida && !cena) return null
        const abierto = abiertos[dia]
        return (
          <div key={dia} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(dia)}
              className="w-full flex items-center justify-between px-3 py-2 bg-green-select/10 dark:bg-green-900/20 hover:bg-green-select/20 dark:hover:bg-green-900/30 transition-colors"
            >
              <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">{DIAS_LABEL[dia]}</span>
              <span className={`text-gray-400 text-xs transition-transform duration-200 ${abierto ? 'rotate-0' : '-rotate-90'}`}>▾</span>
            </button>
            {abierto && (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {comida && (
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{t.exp_comida}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{comida.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{comida.descripcion_corta}</p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400">⏱ {comida.tiempo_prep} min</span>
                      <span className="text-[10px] text-gray-400">🔥 {comida.calorias_aprox} kcal</span>
                      {comida.ingredientes?.length > 0 && (
                        <span className="text-[10px] text-gray-400">🧄 {comida.ingredientes.slice(0,3).map(i => i.nombre).join(', ')}{comida.ingredientes.length > 3 ? '…' : ''}</span>
                      )}
                    </div>
                  </div>
                )}
                {cena && (
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{t.exp_cena}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cena.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cena.descripcion_corta}</p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400">⏱ {cena.tiempo_prep} min</span>
                      <span className="text-[10px] text-gray-400">🔥 {cena.calorias_aprox} kcal</span>
                      {cena.ingredientes?.length > 0 && (
                        <span className="text-[10px] text-gray-400">🧄 {cena.ingredientes.slice(0,3).map(i => i.nombre).join(', ')}{cena.ingredientes.length > 3 ? '…' : ''}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.057 23.944a.5.5 0 0 0 .611.611l6.092-1.475A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.877 9.877 0 0 1-5.036-1.378l-.36-.214-3.733.904.92-3.635-.234-.374A9.859 9.859 0 0 1 2.106 12C2.106 6.533 6.533 2.106 12 2.106S21.894 6.533 21.894 12 17.467 21.894 12 21.894z"/>
  </svg>
)

const waClass = 'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors'

// ── sub-componentes ────────────────────────────────────────────────────────────

function ExportCard({
  icon, title, subtitle, accent, children, badge,
}: {
  icon: string; title: string; subtitle: string; accent: string; badge?: string | number; children: React.ReactNode
}) {
  const accentMap: Record<string, string> = {
    green: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900',
    blue:  'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900',
    purple:'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900',
    orange:'bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900',
  }
  const iconMap: Record<string, string> = {
    green: 'bg-green-100 dark:bg-green-900/40',
    blue:  'bg-blue-100 dark:bg-blue-900/40',
    purple:'bg-purple-100 dark:bg-purple-900/40',
    orange:'bg-orange-100 dark:bg-orange-900/40',
  }
  return (
    <div className={`rounded-2xl border p-4 ${accentMap[accent]}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${iconMap[accent]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{title}</p>
            {badge !== undefined && (
              <span className="text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{badge}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ActionBtn({
  onClick, disabled, loading, children, variant = 'ghost',
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode; variant?: 'ghost' | 'solid'
}) {
  const base = 'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-40'
  const ghost = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
  const solid = 'bg-gray-800 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100'
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variant === 'solid' ? solid : ghost}`}>
      {loading ? <span className="animate-pulse">…</span> : children}
    </button>
  )
}

// ── página principal ───────────────────────────────────────────────────────────

export default function Exportar() {
  const { t } = useI18n()
  const { listas } = useListasCompartidas()

  // Construir menú igual que Menu.tsx: desde estados + seleccion
  const estados = recuperar<Record<ClaveMenu, { estado: string; datos?: { opciones: Receta[] } }>>('menu_estados') ?? ({} as Record<ClaveMenu, { estado: string; datos?: { opciones: Receta[] } }>)
  const seleccion = recuperar<Record<ClaveMenu, number>>('menu_seleccion') ?? ({} as Record<ClaveMenu, number>)
  const menu: MenuSemanal = (() => {
    const m: MenuSemanal = {}
    for (const dia of DIAS) {
      for (const franja of FRANJAS) {
        const clave = `${dia}_${franja}` as ClaveMenu
        const idx = seleccion[clave] ?? 0
        const opciones = estados[clave]?.datos?.opciones
        if (estados[clave]?.estado === 'listo' && opciones?.[idx]) m[clave] = opciones[idx]
      }
    }
    return m
  })()
  const numRecetas = Object.values(menu).filter(Boolean).length

  // Lista personal desde localStorage
  const comprarSet = new Set(recuperar<string[]>('lista_comprar_v3') ?? [])
  const compradoSet = new Set(recuperar<string[]>('lista_comprado') ?? [])
  const cantidades = recuperar<Record<string, number>>('lista_cantidades') ?? {}
  const unidades = recuperar<Record<string, string>>('lista_unidades') ?? {}
  const precios = recuperar<Record<string, number>>('lista_precios') ?? {}
  const custom = recuperar<string[]>('lista_custom_items_v2') ?? []
  function parsearUnidad(raw: string | undefined): { modo: 'ud' | 'kg'; precioKg?: number } {
    if (!raw) return { modo: 'ud' }
    try { return JSON.parse(raw) } catch { return { modo: 'ud' } }
  }

  const todosItems = [...Array.from(comprarSet), ...custom.filter(c => !comprarSet.has(c))]
  const listaPersonal: ItemLista[] = todosItems.map(nombre => {
    const { modo } = parsearUnidad(unidades[nombre])
    return {
      nombre,
      cantidad: cantidades[nombre],
      unidad: modo === 'kg' ? 'kg' : undefined,
      precio: precios[nombre],
      comprado: compradoSet.has(nombre),
    }
  })

  // Estados
  const [copiadoMenu, setCopiadoMenu] = useState(false)
  const [copiadoLista, setCopiadoLista] = useState(false)
  const [copiadoCompartida, setCopiadoCompartida] = useState<Record<string, boolean>>({})
  const [generandoStories, setGenerandoStories] = useState(false)
  const [storiesThemeId, setStoriesThemeId] = useState('gym')

  async function compartirStories() {
    const theme = STORIES_THEMES.find(t => t.id === storiesThemeId) ?? STORIES_THEMES[0]
    setGenerandoStories(true)
    try {
      const blob = await generarStoriesBlob(menu, theme)
      const file = new File([blob], 'menu-semana.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mi menú de la semana' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'menu-semana.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setErrorMsg('No se pudo generar la imagen')
    } finally {
      setGenerandoStories(false)
    }
  }
  const [errorMsg, setErrorMsg] = useState('')
  const [listaCompartidaItems, setListaCompartidaItems] = useState<Record<string, ItemLista[]>>({})

  const cargarItemsCompartida = useCallback(async (listaId: string) => {
    const { data } = await supabase.from('lista_compartida_items').select('*').eq('lista_id', listaId).order('created_at')
    setListaCompartidaItems(prev => ({ ...prev, [listaId]: (data ?? []) as ItemLista[] }))
  }, [])

  // Cargar automáticamente todas las listas compartidas al entrar
  useEffect(() => {
    listas.forEach(l => cargarItemsCompartida(l.id))
  }, [listas, cargarItemsCompartida])


  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24 page-enter">
      <h1 className="text-2xl font-black tracking-tight mb-1 mt-2">{t.exp_titulo}</h1>
      <p className="text-sm text-gray-400 mb-6">{t.exp_subtitulo}</p>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
        </div>
      )}

      <div className="space-y-4">

        {/* ── Menú semanal ── */}
        <ExportCard icon="🥗" title={t.exp_menu_titulo} subtitle={t.exp_menu_desc} accent="green" badge={numRecetas > 0 ? `${numRecetas} ${t.exp_menu_recetas}` : undefined}>
          {numRecetas === 0 ? (
            <p className="text-xs text-gray-400 italic">{t.exp_menu_vacio}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <ActionBtn onClick={() => copiar(buildMenuTexto(menu), setCopiadoMenu)} disabled={copiadoMenu}>
                  {copiadoMenu ? t.exp_copiado : t.exp_copiar}
                </ActionBtn>
                <a href={`https://wa.me/?text=${encodeURIComponent(buildMenuTexto(menu))}`} target="_blank" rel="noopener noreferrer" className={waClass}>
                  <WaIcon /> WhatsApp
                </a>
              </div>

              {/* Theme picker + Stories button */}
              <div className="mt-3 p-3 bg-white/5 dark:bg-black/20 rounded-2xl border border-white/10 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Estilo de la imagen</p>
                <div className="flex gap-2">
                  {STORIES_THEMES.map(th => (
                    <button
                      key={th.id}
                      onClick={() => setStoriesThemeId(th.id)}
                      title={th.name}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all ${
                        storiesThemeId === th.id
                          ? 'border-white/60 scale-105'
                          : 'border-transparent hover:border-white/20'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full shrink-0"
                        style={{ background: `linear-gradient(135deg, ${th.swatch[0]}, ${th.swatch[1]})`, boxShadow: storiesThemeId === th.id ? '0 0 0 2px white' : 'none' }}
                      />
                      <span className="text-[9px] text-gray-400 font-medium">{th.emoji}</span>
                      <span className="text-[9px] text-gray-400">{th.name}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={compartirStories}
                  disabled={generandoStories}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)', color: 'white' }}
                >
                  {generandoStories ? (
                    <span className="animate-pulse">Generando imagen…</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      Compartir en Stories
                    </>
                  )}
                </button>
              </div>
              {/* Preview visual del menú */}
              <MenuPreview menu={menu} t={t} />
            </>
          )}
        </ExportCard>

        {/* ── Lista personal ── */}
        <ExportCard icon="🛒" title={t.exp_lista_titulo} subtitle={t.exp_lista_desc} accent="blue" badge={listaPersonal.length > 0 ? `${listaPersonal.filter(i => !i.comprado).length} ${t.exp_lista_pendientes}` : undefined}>
          {listaPersonal.length === 0 ? (
            <p className="text-xs text-gray-400 italic">{t.exp_lista_vacia}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <ActionBtn onClick={() => copiar(buildListaTexto(listaPersonal, t.exp_lista_titulo), setCopiadoLista)} disabled={copiadoLista}>
                  {copiadoLista ? t.exp_copiado : t.exp_copiar}
                </ActionBtn>
                <a href={`https://wa.me/?text=${encodeURIComponent(buildListaTexto(listaPersonal, 'Lista de la compra'))}`} target="_blank" rel="noopener noreferrer" className={waClass}>
                  <WaIcon /> WhatsApp
                </a>
              </div>
              {/* Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {listaPersonal.filter(i => !i.comprado).slice(0, 8).map((item, idx) => (
                  <div key={item.nombre + idx} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm flex-1 truncate">{item.nombre}</span>
                    {item.cantidad && <span className="text-xs text-gray-400 shrink-0">{item.cantidad}{item.unidad ? ' ' + item.unidad : ''}</span>}
                    {item.precio && <span className="text-xs font-medium text-green-select shrink-0">{item.precio.toFixed(2)} €</span>}
                  </div>
                ))}
                {listaPersonal.filter(i => !i.comprado).length > 8 && (
                  <div className="px-3 py-2 text-xs text-gray-400">+{listaPersonal.filter(i => !i.comprado).length - 8} más…</div>
                )}
              </div>
            </>
          )}
        </ExportCard>

        {/* ── Listas compartidas ── */}
        {listas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t.exp_compartidas_titulo}</p>
            <div className="space-y-3">
              {listas.map(lista => {
                const items = listaCompartidaItems[lista.id]
                const pendientes = items?.filter(i => !i.comprado && !(i as { en_casa?: boolean }).en_casa) ?? []
                const isCopied = copiadoCompartida[lista.id]
                return (
                  <ExportCard key={lista.id} icon="👥" title={lista.nombre} subtitle={`${t.exp_codigo} ${lista.codigo}`} accent="purple" badge={items ? `${pendientes.length} ${t.exp_lista_pendientes}` : undefined}>
                    {!items ? (
                      <p className="text-xs text-gray-400 animate-pulse">{t.exp_cargando}</p>
                    ) : items.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">{t.exp_lista_vacia2}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <ActionBtn
                            onClick={() => copiar(buildListaTexto(items.filter(i => !(i as { en_casa?: boolean }).en_casa), lista.nombre), (v) => setCopiadoCompartida(p => ({ ...p, [lista.id]: v })))}
                            disabled={isCopied}
                          >
                            {isCopied ? t.exp_copiado : t.exp_copiar}
                          </ActionBtn>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(buildListaTexto(items.filter(i => !(i as { en_casa?: boolean }).en_casa), lista.nombre))}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.057 23.944a.5.5 0 0 0 .611.611l6.092-1.475A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.877 9.877 0 0 1-5.036-1.378l-.36-.214-3.733.904.92-3.635-.234-.374A9.859 9.859 0 0 1 2.106 12C2.106 6.533 6.533 2.106 12 2.106S21.894 6.533 21.894 12 17.467 21.894 12 21.894z"/></svg>
                            WhatsApp
                          </a>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700 max-h-48 overflow-y-auto">
                          {pendientes.slice(0, 8).map((item, idx) => (
                            <div key={item.nombre + idx} className="flex items-center gap-2 px-3 py-2">
                              <span className="text-sm flex-1 truncate">{item.nombre}</span>
                              {(item as { cantidad?: number }).cantidad && <span className="text-xs text-gray-400 shrink-0">{(item as { cantidad?: number }).cantidad}</span>}
                              {(item as { precio?: number }).precio && <span className="text-xs font-medium text-purple-500 shrink-0">{((item as { precio?: number }).precio ?? 0).toFixed(2)} €</span>}
                            </div>
                          ))}
                          {pendientes.length > 8 && (
                            <div className="px-3 py-2 text-xs text-gray-400">+{pendientes.length - 8} más…</div>
                          )}
                        </div>
                      </>
                    )}
                  </ExportCard>
                )
              })}
            </div>
          </div>
        )}


      </div>
    </div>
  )
}
