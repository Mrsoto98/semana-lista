const CACHE = 'mydreams-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(fetch(e.request, { cache: 'no-store' }))
    return
  }
  e.respondWith(fetch(e.request))
})

self.addEventListener('push', e => {
  let data = {}
  try { data = e.data?.json() ?? {} } catch {}
  const {
    title = 'myDreams ✦',
    body = '',
    url = '/',
    tag = 'push',
    icon = '/icon-192.png',
    badge = '/icon-192.png',
  } = data
  e.waitUntil(
    self.registration.showNotification(title, { body, icon, badge, tag, data: { url } })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url); return }
      clients.openWindow(url)
    })
  )
})
