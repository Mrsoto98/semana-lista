import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, DEFAULT_THEME } from './lib/themes'

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Apply persisted theme before first render to avoid flash
const stored = localStorage.getItem('dreamlog-auth')
const themeId = stored ? (JSON.parse(stored)?.state?.themeId ?? DEFAULT_THEME) : DEFAULT_THEME
applyTheme(themeId)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
