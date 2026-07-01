import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verificar el JWT del usuario
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })

  // Eliminar archivos de storage del usuario
  const { data: archivos } = await supabaseAdmin.storage.from('avatars').list(user.id)
  if (archivos?.length) {
    await supabaseAdmin.storage.from('avatars').remove(archivos.map(f => `${user.id}/${f.name}`))
  }

  // Eliminar el usuario (cascada borra usuarios, perfiles, listas creadas, membresías, amistades)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })

  return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
})
