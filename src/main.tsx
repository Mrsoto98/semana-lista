import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Version-based auto-reload (skip on auth callback to preserve tokens)
;(async () => {
  try {
    const isAuthCallback = window.location.pathname === '/auth/callback'
    const hasAuthTokens = window.location.hash.includes('access_token')
    if (isAuthCallback || hasAuthTokens) return

    const res = await fetch('/version.json?t=' + Date.now())
    const { v } = await res.json()
    const LS_KEY = 'app-version'
    const stored = localStorage.getItem(LS_KEY)
    if (stored && stored !== v) {
      localStorage.setItem(LS_KEY, v)
      location.reload()
    } else {
      localStorage.setItem(LS_KEY, v)
    }
  } catch { /* ignore */ }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
