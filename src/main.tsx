import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Aplicar tamaño de fuente guardado antes de renderizar
;(function aplicarTamanoFuente() {
  const t = localStorage.getItem('semana-lista:tamano') as 'normal' | 'mediano' | 'grande' | null
  const sizes = { normal: '100%', mediano: '112.5%', grande: '125%' }
  document.documentElement.style.fontSize = sizes[t ?? 'normal']
})()

// Detectar nueva versión desplegada y forzar recarga limpia
;(async function checkVersion() {
  try {
    const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
    const { v } = await r.json() as { v: number }
    const stored = localStorage.getItem('semana-lista:build-v')
    if (stored && stored !== String(v)) {
      localStorage.setItem('semana-lista:build-v', String(v))
      // Nuclear: borrar todos los caches y desregistrar SWs antes de recargar
      // para que el SW antiguo no intercepte la recarga y sirva contenido viejo
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(reg => reg.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      window.location.reload()
    } else {
      localStorage.setItem('semana-lista:build-v', String(v))
    }
  } catch { /* sin red, ignorar */ }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
