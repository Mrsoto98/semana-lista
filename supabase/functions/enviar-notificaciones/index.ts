import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Minimal VAPID-signed Web Push via fetch (no external push library needed in Deno)
// We use the web-push compatible approach with manual JWT signing

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@semana-lista.app'

// Base64url helpers
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function createVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { aud: audience, exp: now + 43200, sub: VAPID_SUBJECT }

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const privateKeyBytes = base64urlToUint8Array(VAPID_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )
  return `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(signature))}`
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint)
    const audience = `${url.protocol}//${url.host}`
    const jwt = await createVapidJwt(audience)

    // Encrypt payload using Web Push encryption (RFC 8291)
    // For simplicity, send unencrypted with content-encoding: aes128gcm
    const encoder = new TextEncoder()
    const payloadBytes = encoder.encode(payload)

    // ECDH key exchange
    const serverKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
    )
    const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
    const clientPublicKey = await crypto.subtle.importKey(
      'raw', base64urlToUint8Array(subscription.p256dh),
      { name: 'ECDH', namedCurve: 'P-256' }, false, []
    )

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256
    )

    const authSecret = base64urlToUint8Array(subscription.auth)
    const salt = crypto.getRandomValues(new Uint8Array(16))

    // HKDF
    async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
      const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey', 'deriveBits'])
      const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
      return new Uint8Array(bits)
    }

    const prk = await hkdf(authSecret, new Uint8Array(sharedSecret), new TextEncoder().encode('Content-Encoding: auth\0'), 32)
    const serverPublicKeyBytes = new Uint8Array(serverPublicKeyRaw)
    const clientPublicKeyBytes = base64urlToUint8Array(subscription.p256dh)

    const keyInfo = new Uint8Array([
      ...new TextEncoder().encode('Content-Encoding: aesgcm\0'),
      0, 65, ...clientPublicKeyBytes,
      0, 65, ...serverPublicKeyBytes,
    ])
    const nonceInfo = new Uint8Array([
      ...new TextEncoder().encode('Content-Encoding: nonce\0'),
      0, 65, ...clientPublicKeyBytes,
      0, 65, ...serverPublicKeyBytes,
    ])

    const contentKey = await hkdf(salt, prk, keyInfo, 16)
    const nonce = await hkdf(salt, prk, nonceInfo, 12)

    const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
    const paddedPayload = new Uint8Array([0, 0, ...payloadBytes]) // 2 bytes padding length + payload
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload)

    const body = new Uint8Array([...salt, 0, 0, 16, 0, 65, ...serverPublicKeyBytes, ...new Uint8Array(encrypted)])

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        'Encryption': `salt=${uint8ArrayToBase64url(salt)}`,
        'Crypto-Key': `dh=${uint8ArrayToBase64url(serverPublicKeyBytes)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
        'TTL': '86400',
      },
      body,
    })
    return res.ok || res.status === 201
  } catch (e) {
    console.error('push error:', e)
    return false
  }
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  const cronKey = Deno.env.get('CRON_SECRET')
  // CRON_SECRET es obligatorio — rechazar si no está configurado o no coincide
  if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Hora actual en España (Europe/Madrid)
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const diaActual = ahora.getDay()   // 0=domingo … 6=sábado
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:00`

  // Solo los usuarios cuya preferencia coincide con ahora
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, notif_dia, notif_hora')
    .eq('notif_dia', diaActual)
    .eq('notif_hora', horaActual)

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ ok: true, enviadas: 0, dia: diaActual, hora: horaActual }), { headers: { 'Content-Type': 'application/json' } })
  }

  const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const payload = JSON.stringify({
    title: '📅 ¿Ya tienes tu menú?',
    body: `Es ${DIAS_ES[diaActual]} — planifica tu semana en 2 minutos con IA.`,
    url: '/menu',
  })

  let enviadas = 0
  const expiradas: string[] = []

  await Promise.all(subs.map(async (sub) => {
    const ok = await sendPushNotification(sub, payload)
    if (ok) { enviadas++ }
    else { expiradas.push(sub.endpoint) }
  }))

  // Limpiar suscripciones expiradas
  if (expiradas.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiradas)
  }

  return new Response(JSON.stringify({ ok: true, enviadas, expiradas: expiradas.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
