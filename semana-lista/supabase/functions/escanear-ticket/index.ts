// supabase/functions/escanear-ticket/index.ts
import { createClient } from 'npm:@supabase/supabase-js'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://semana-lista-2wbr.vercel.app'
const ALLOWED_ORIGINS = new Set([
  ALLOWED_ORIGIN,
  'https://semana-lista-2wbr.vercel.app',
  'https://semana-lista.vercel.app',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const isAllowed =
    ALLOWED_ORIGINS.has(origin) ||
    origin.startsWith('http://localhost') || origin.startsWith('https://localhost') ||
    origin.startsWith('http://192.168.') || origin.startsWith('capacitor://') || origin === ''
  const allowed = isAllowed ? origin : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

async function verificarUsuario(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

interface ProductoAprendido {
  texto_ticket: string
  nombre_es: string
  nombre_ca: string | null
  precio: number | null
  unidad: string | null
}

async function buscarConocidos(textosTicket: string[]): Promise<Map<string, ProductoAprendido>> {
  const result = new Map<string, ProductoAprendido>()
  if (textosTicket.length === 0) return result
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase
      .from('ticket_productos')
      .select('texto_ticket, nombre_es, nombre_ca, precio, unidad')
      .in('texto_ticket', textosTicket.map(t => t.toLowerCase().trim()))
    if (error) { console.error('DB buscar error:', error.message); return result }
    for (const row of (data ?? [])) {
      result.set(row.texto_ticket, row as ProductoAprendido)
    }
  } catch (e) {
    console.error('buscarConocidos exception:', e)
  }
  return result
}

interface ItemConfirmado {
  textoTicket: string
  nombreEs: string
  nombreCa: string | null
  precio: number | null
  fuente: 'db' | 'ia'
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const userId = await verificarUsuario(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Token requerido' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // ── Acción: guardar productos confirmados en la BD ─────────────────────────
  if (body.action === 'guardar') {
    const productos = body.productos as Array<{
      textoTicket: string
      nombreEs: string
      nombreCa?: string
      nombreMercadona?: string
      precio?: number
      unidad?: string
      precioUnidad?: number
    }>
    if (!Array.isArray(productos) || productos.length === 0) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      await Promise.all(productos.map(p =>
        supabase.rpc('guardar_ticket_producto', {
          p_texto_ticket: p.textoTicket,
          p_nombre_es: p.nombreEs,
          p_nombre_ca: p.nombreCa ?? null,
          p_nombre_mercadona: p.nombreMercadona ?? null,
          p_precio: p.precio ?? null,
          p_unidad: p.unidad ?? null,
          p_precio_unidad: p.precioUnidad ?? null,
        })
      ))
    } catch (e) {
      console.error('guardar error:', e)
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // ── Acción: escanear ticket ────────────────────────────────────────────────
  const imagen = body.imagen as string | undefined
  const tipo = (body.tipo as string | undefined) ?? 'image/jpeg'
  if (!imagen) {
    return new Response(JSON.stringify({ error: 'imagen requerida' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Verificar tamaño (base64 → bytes = len * 0.75)
  const bytesEstimados = imagen.length * 0.75
  if (bytesEstimados > 5 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'Imagen demasiado grande. Por favor, usa la cámara con menor resolución.' }), {
      status: 413, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Llamada a Claude vision para extraer todos los productos del ticket
  let anthropicRes: Response
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: tipo, data: imagen },
            },
            {
              type: 'text',
              text: `Eres un experto en tickets de supermercado español. El ticket puede estar en español o catalán (Mercadona en Cataluña imprime en catalán).

Analiza la imagen y extrae TODOS los productos comprados (ignora subtotales, descuentos, IVA, número de cajero, fecha, etc.).

Para cada producto:
- textoTicket: copia EXACTAMENTE el texto tal como aparece en el ticket (sin modificar)
- nombreEs: traduce al español genérico (sin marca). Ej: "LLET SNCRA" → "leche entera", "OUS" → "huevos", "PA MOTLLE" → "pan de molde"
- nombreCa: nombre en catalán si el ticket está en catalán, o null si está en español
- precio: precio numérico del producto (null si no es legible)
- dudoso: true SOLO si el texto es completamente ilegible o ambiguo

Devuelve ÚNICAMENTE este JSON, sin texto adicional:
{
  "productos": [
    {"textoTicket": "LLET SNCRA 1L", "nombreEs": "leche entera", "nombreCa": "llet sencera", "precio": 0.89, "dudoso": false},
    {"textoTicket": "HCND CR VRD 500", "nombreEs": "", "nombreCa": null, "precio": null, "dudoso": true}
  ]
}`,
            },
          ],
        }],
      }),
    })
  } catch (e) {
    console.error('Anthropic fetch error:', e)
    return new Response(JSON.stringify({ error: 'No se pudo conectar con el servicio de IA' }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    console.error('Claude API error', anthropicRes.status, errText)
    return new Response(JSON.stringify({ error: `Error de IA (${anthropicRes.status})` }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const claudeData = await anthropicRes.json()
  const textoRespuesta = claudeData.content?.[0]?.text ?? ''

  let productosRaw: Array<{ textoTicket: string; nombreEs: string; nombreCa: string | null; precio: number | null; dudoso: boolean }> = []
  try {
    const match = textoRespuesta.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      productosRaw = Array.isArray(parsed.productos) ? parsed.productos : []
    }
  } catch (e) {
    console.error('JSON parse error:', e, 'Raw:', textoRespuesta.slice(0, 200))
  }

  if (productosRaw.length === 0) {
    console.warn('Claude devolvió 0 productos. Raw:', textoRespuesta.slice(0, 300))
    return new Response(JSON.stringify({ confirmados: [], dudosos: [] }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Buscar productos ya conocidos en la BD para enriquecer con datos aprendidos
  const textosTicket = productosRaw.map(p => p.textoTicket.toLowerCase().trim())
  const conocidos = await buscarConocidos(textosTicket)

  const confirmados: ItemConfirmado[] = []
  const dudosos: string[] = []

  for (const p of productosRaw) {
    if (p.dudoso || !p.nombreEs) {
      dudosos.push(p.textoTicket)
      continue
    }
    const clave = p.textoTicket.toLowerCase().trim()
    const aprendido = conocidos.get(clave)
    if (aprendido) {
      confirmados.push({
        textoTicket: p.textoTicket,
        nombreEs: aprendido.nombre_es,
        nombreCa: aprendido.nombre_ca,
        precio: p.precio ?? aprendido.precio,
        fuente: 'db',
      })
    } else {
      confirmados.push({
        textoTicket: p.textoTicket,
        nombreEs: p.nombreEs,
        nombreCa: p.nombreCa ?? null,
        precio: p.precio ?? null,
        fuente: 'ia',
      })
    }
  }

  return new Response(
    JSON.stringify({ confirmados, dudosos }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
})
