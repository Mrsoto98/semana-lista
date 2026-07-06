// src/components/AnuncioRewarded.tsx
import { useState, useEffect } from 'react'
import { esNativo, mostrarAnuncioRewarded } from '../lib/ads'

const DURACION = 8

interface Props {
  onRecompensa: () => void
  onCancelar: () => void
}

export function AnuncioRewarded({ onRecompensa, onCancelar }: Props) {
  const [segundos, setSegundos] = useState(DURACION)
  const [terminado, setTerminado] = useState(false)
  const [cargando, setCargando] = useState(false)

  // En Android nativo → delegar a AdMob directamente
  useEffect(() => {
    if (!esNativo()) return
    setCargando(true)
    mostrarAnuncioRewarded().then(resultado => {
      setCargando(false)
      if (resultado === 'recompensa') onRecompensa()
      else onCancelar()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // En web → countdown simulado
  useEffect(() => {
    if (esNativo()) return
    if (segundos <= 0) { setTerminado(true); return }
    const id = setTimeout(() => setSegundos(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [segundos])

  const progreso = ((DURACION - segundos) / DURACION) * 100

  // En nativo mostramos solo un spinner mientras AdMob carga
  if (esNativo()) {
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

  // En web → anuncio simulado con countdown
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
          <div className="relative bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 h-52 flex flex-col items-center justify-center gap-3 p-6">
            <div className="absolute top-3 left-3 bg-black/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              ANUNCIO
            </div>
            {!terminado && (
              <button onClick={onCancelar} className="absolute top-2 right-3 text-white/60 text-xs">
                ✕ Cerrar
              </button>
            )}
            <div className="text-5xl">🍽️</div>
            <p className="text-white font-black text-xl text-center leading-tight">Semana Lista Pro</p>
            <p className="text-white/80 text-sm text-center">Generaciones ilimitadas y sin anuncios</p>
            <div className="bg-white/20 border border-white/30 text-white text-xs font-bold px-4 py-1.5 rounded-full">
              Próximamente
            </div>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-green-select transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {terminado ? '¡Listo!' : `Espera ${segundos}s...`}
              </span>
              <button
                onClick={terminado ? onRecompensa : undefined}
                disabled={!terminado}
                className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${
                  terminado
                    ? 'bg-green-select text-white shadow-lg active:scale-95'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {terminado ? '🎁 Obtener generaciones' : `${segundos}s`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
