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
;(function checkVersion() {
  fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.json())
    .then(({ v }: { v: number }) => {
      const stored = localStorage.getItem('semana-lista:build-v')
      if (stored && stored !== String(v)) {
        localStorage.setItem('semana-lista:build-v', String(v))
        window.location.reload()
      } else {
        localStorage.setItem('semana-lista:build-v', String(v))
      }
    })
    .catch(() => {})
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
