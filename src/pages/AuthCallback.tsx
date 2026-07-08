import { useEffect } from 'react'

// Página intermedia de OAuth — carga en el navegador (CCT) y redirige al scheme nativo
// El servidor (Supabase) redirige aquí con los tokens en el hash.
// Desde JS, el redirect al scheme sí dispara el Intent en Android.
export default function AuthCallback() {
  useEffect(() => {
    const destino = 'com.semanalista.app://auth/continue' + window.location.search + window.location.hash
    window.location.replace(destino)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🥗</div>
      <p style={{ color: '#555', margin: 0 }}>Volviendo a la app...</p>
      <a
        href={'com.semanalista.app://auth/continue' + window.location.search + window.location.hash}
        style={{ marginTop: 8, color: '#22c55e', fontWeight: 600, textDecoration: 'none' }}
      >
        Toca aquí si no abre automáticamente
      </a>
    </div>
  )
}
