// src/main.tsx
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
