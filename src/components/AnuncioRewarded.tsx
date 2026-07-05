import { useState, useEffect } from 'react'

const DURACION = 8 // segundos

interface Props {
  onRecompensa: () => void
  onCancelar: () => void
}

export function AnuncioRewarded({ onRecompensa, onCancelar }: Props) {
  const [segundos, setSegundos] = useState(DURACION)
  const [terminado, setTerminado] = useState(false)

  useEffect(() => {
    if (segundos <= 0) { setTerminado(true); return }
    const id = setTimeout(() => setSegundos(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [segundos])

  const progreso = ((DURACION - segundos) / DURACION) * 100

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90">
      <div className="w-full max-w-sm mx-4">
        {/* Anuncio simulado */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
          {/* "Anuncio" placeholder */}
          <div className="relative bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 h-52 flex flex-col items-center justify-center gap-3 p-6">
            <div className="absolute top-3 left-3 bg-black/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              ANUNCIO
            </div>
            {!terminado && (
              <button
                onClick={onCancelar}
                className="absolute top-2 right-3 text-white/60 text-xs"
              >
                ✕ Cerrar
              </button>
            )}
            <div className="text-5xl">🍽️</div>
            <p className="text-white font-black text-xl text-center leading-tight">
              Semana Lista Pro
            </p>
            <p className="text-white/80 text-sm text-center">
              Generaciones ilimitadas y sin anuncios
            </p>
            <div className="bg-white/20 border border-white/30 text-white text-xs font-bold px-4 py-1.5 rounded-full">
              Próximamente
            </div>
          </div>

          {/* Barra de progreso + contador */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {terminado ? '¡Anuncio completado!' : `Espera ${segundos}s para obtener tu generación extra`}
              </p>
              {!terminado && (
                <span className="text-sm font-black text-gray-700 dark:text-gray-200 tabular-nums">
                  {segundos}s
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-select rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progreso}%` }}
              />
            </div>

            {terminado ? (
              <button
                onClick={onRecompensa}
                className="w-full py-3 bg-green-select text-white font-black rounded-xl text-base shadow-lg active:scale-95 transition-transform"
              >
                ✨ Reclamar generación extra
              </button>
            ) : (
              <button
                disabled
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-400 font-semibold rounded-xl text-sm"
              >
                Espera {segundos}s…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
