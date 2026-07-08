// Bitácora del Sueño — Service Worker
const CACHE_NAME = 'bitacora-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Push notification handler
self.addEventListener('push', function (event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}

  const title   = data.title || '🌙 Bitácora del Sueño'
  const options = {
    body: data.body || '¿Tuviste algún sueño esta noche? Regístralo antes de que lo olvides ✨',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: 'morning-reminder',
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/diary' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click — open or focus the app
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/diary'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
