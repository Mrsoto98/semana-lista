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
            text: `Eres un asistente que lee tickets de compra de supermercado.
Extrae TODOS los productos comprados del ticket.
Para cada producto, devuelve su nombre genérico en español (no la marca comercial, sino el tipo de producto).
Por ejemplo: "HACENDADO LECHE ENTERA" → "leche entera", "HUEVOS CAMPEROS M" → "huevos", "PECHUGA POLLO" → "pechuga de pollo".
Devuelve ÚNICAMENTE un array JSON con los nombres, sin explicación ni texto adicional. Ejemplo:
["leche entera","huevos","pechuga de pollo","tomates","pan de molde"]`,
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

  let productos: string[] = []
  try {
    // Extraer el array JSON de la respuesta
    const match = texto.match(/\[[\s\S]*\]/)
    if (match) productos = JSON.parse(match[0])
  } catch {
    productos = []
  }

  return new Response(
    JSON.stringify({ productos }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
})
