// src/components/AnuncioRewarded.tsx
import { useState, useEffect } from 'react'
import { esNativo, mostrarAnuncioRewarded, mostrarAnuncioRewardedWeb } from '../lib/ads'

interface Props {
  onRecompensa: () => void
  onCancelar: () => void
}

export function AnuncioRewarded({ onRecompensa, onCancelar }: Props) {
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (esNativo()) {
      // Android → AdMob nativo
      mostrarAnuncioRewarded().then(resultado => {
        if (resultado === 'recompensa') onRecompensa()
        else onCancelar()
      })
    } else {
      // Web/iPhone → AdSense Ad Placement API
      mostrarAnuncioRewardedWeb().then(resultado => {
        setCargando(false)
        if (resultado === 'recompensa') onRecompensa()
        else onCancelar()
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Spinner mientras Google carga el anuncio (nativo y web)
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90">
      {cargando && (
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-sm font-semibold opacity-70">Cargando anuncio...</p>
        </div>
      )}
    </div>
  )
}
