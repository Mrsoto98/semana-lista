import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, DEFAULT_THEME } from './lib/themes'

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // When a new SW takes over, reload the page
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'activated') location.reload()
        })
      })
    }).catch(() => {})
  })
}

// Version-based auto-reload fallback
;(async () => {
  const LS_KEY = 'app-version'
  try {
    const res = await fetch('/version.json?t=' + Date.now())
    const { v } = await res.json()
    const stored = localStorage.getItem(LS_KEY)
    if (stored && stored !== v) {
      localStorage.setItem(LS_KEY, v)
      location.reload()
    } else {
      localStorage.setItem(LS_KEY, v)
    }
  } catch {}
})()

// Apply persisted theme before first render to avoid flash
const stored = localStorage.getItem('dreamlog-auth')
const themeId = stored ? (JSON.parse(stored)?.state?.themeId ?? DEFAULT_THEME) : DEFAULT_THEME
applyTheme(themeId)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
