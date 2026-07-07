import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://semana-lista.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
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

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verificar el JWT del usuario
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Verificar contraseña antes de borrar (protege frente a tokens robados)
  // Solo aplica a usuarios con email/password; los de OAuth no tienen contraseña
  const isEmailProvider = user.app_metadata?.provider === 'email' || user.identities?.some((i: { provider: string }) => i.provider === 'email')
  if (isEmailProvider) {
    let password: string | undefined
    try {
      const body = await req.json()
      password = body?.password
    } catch { /* body vacío */ }
    if (!password) return new Response(JSON.stringify({ error: 'Se requiere la contraseña para eliminar la cuenta.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({ email: user.email!, password })
    if (signInError) return new Response(JSON.stringify({ error: 'Contraseña incorrecta.' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
    await supabaseAnon.auth.signOut()
  }

  // Eliminar archivos de storage del usuario
  const { data: archivos } = await supabaseAdmin.storage.from('avatars').list(user.id)
  if (archivos?.length) {
    await supabaseAdmin.storage.from('avatars').remove(archivos.map(f => `${user.id}/${f.name}`))
  }

  // Eliminar el usuario (cascada borra usuarios, perfiles, listas creadas, membresías, amistades)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('eliminar-cuenta deleteUser error:', error.message)
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
