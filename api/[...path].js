export const config = { runtime: 'edge' }

const BACKEND = 'https://dreamlog-backend-alxo.onrender.com'

export default async function handler(request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '') || '/'

  const forwardHeaders = new Headers()
  for (const [key, value] of request.headers.entries()) {
    const k = key.toLowerCase()
    if (k === 'authorization' || k === 'content-type' || k === 'content-length') {
      forwardHeaders.set(key, value)
    }
  }

  let body
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer()
  }

  const response = await fetch(`${BACKEND}${path}${url.search}`, {
    method: request.method,
    headers: forwardHeaders,
    body: body || undefined,
  })

  const responseBody = await response.arrayBuffer()

  return new Response(responseBody, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  })
}
