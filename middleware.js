const BACKEND = 'https://dreamlog-backend-a1xo.onrender.com'

export const config = {
  matcher: '/api/:path*',
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const backendUrl = BACKEND + url.pathname + url.search

  const headers = new Headers()
  const auth = request.headers.get('authorization')
  const ct = request.headers.get('content-type')
  if (auth) headers.set('authorization', auth)
  if (ct) headers.set('content-type', ct)

  let body
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer()
  }

  try {
    const res = await fetch(backendUrl, { method: request.method, headers, body })
    const data = await res.arrayBuffer()
    return new Response(data, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'backend_unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }
}
