// supabase/functions/escanear-ticket/index.ts
import { createClient } from 'npm:@supabase/supabase-js'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://semana-lista-2wbr.vercel.app'
const ALLOWED_ORIGINS = new Set([
  ALLOWED_ORIGIN,
  'https://semana-lista-2wbr.vercel.app',
  'https://semana-lista.vercel.app',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const isAllowed = ALLOWED_ORIGINS.has(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://192.168.')
  const allowed = isAllowed ? origin : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

async function verificarUsuario(req: Request): Promise<{ userId: string | null; error: string | null }> {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return { userId: null, error: 'Token requerido' }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { userId: null, error: 'Token inválido' }
    return { userId: user.id, error: null }
  } catch {
    return { userId: null, error: 'Error de autenticación' }
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const { userId, error: authError } = await verificarUsuario(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: authError }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  let imagen: string
  let tipo: string
  try {
    const body = await req.json()
    imagen = body.imagen  // base64 sin prefijo data:...
    tipo = body.tipo ?? 'image/jpeg'
    if (!imagen) throw new Error('imagen requerida')
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Llamada a Claude vision para extraer productos del ticket
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: tipo, data: imagen },
          },
          {
            type: 'text',
            text: `Eres un asistente experto en tickets de compra de supermercado español.
El ticket puede estar en español o en catalán (Mercadona en Cataluña imprime en catalán).
Analiza la imagen con cuidado: lee el nombre del producto Y el precio que aparece junto a él.

Para cada línea de producto del ticket:
- Traduce al español si está en catalán. Ejemplos: "llet sencera" → "leche entera", "ous" → "huevos", "pa de motlle" → "pan de molde", "pollastre" → "pollo", "vedella" → "ternera"
- Elimina la marca (Hacendado, Deliplus, etc.) y quédate con el tipo de producto genérico en español
- Extrae también el precio si es legible (número con decimales, p.ej. 1.25)
- Si lo identificas claramente → ponlo en "confirmados" como objeto {nombre, precio}
- Si el texto es ilegible o muy ambiguo → ponlo en "dudosos" con el texto exacto del ticket

Devuelve ÚNICAMENTE este JSON sin ningún texto adicional:
{"confirmados":[{"nombre":"leche entera","precio":0.89},{"nombre":"huevos","precio":2.15}],"dudosos":["HCND CR VRD 500","????"]}`,
          },
        ],
      }],
    }),
  })

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text()
    console.error('Claude error:', err)
    return new Response(JSON.stringify({ error: 'Error procesando imagen' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const claudeData = await anthropicRes.json()
  const texto = claudeData.content?.[0]?.text ?? ''

  let confirmados: { nombre: string; precio?: number }[] = []
  let dudosos: string[] = []
  try {
    const match = texto.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      const raw = Array.isArray(parsed.confirmados) ? parsed.confirmados : []
      // Acepta tanto objetos {nombre, precio} como strings planos
      confirmados = raw.map((item: unknown) =>
        typeof item === 'string' ? { nombre: item } : item as { nombre: string; precio?: number }
      )
      dudosos = Array.isArray(parsed.dudosos) ? parsed.dudosos : []
    }
  } catch {
    confirmados = []
    dudosos = []
  }

  return new Response(
    JSON.stringify({ confirmados, dudosos }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
})
