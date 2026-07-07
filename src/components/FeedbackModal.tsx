import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAnalytics } from '../hooks/useAnalytics'

interface Props {
  onClose: () => void
}

export function FeedbackModal({ onClose }: Props) {
  const { user } = useAuth()
  const { track } = useAnalytics()
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar() {
    if (!mensaje.trim()) return
    setEnviando(true)
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('feedback').insert({
        usuario_id: user?.id ?? null,
        mensaje: mensaje.trim(),
        pagina: window.location.pathname,
      })
      await track('feedback_enviado')
      setEnviado(true)
      setTimeout(onClose, 1500)
    } catch {
      // fallo silencioso — el mensaje igual puede haberse guardado
      setEnviado(true)
      setTimeout(onClose, 1500)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {enviado ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">🙏</p>
            <p className="font-semibold">¡Gracias por tu feedback!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">💬 Enviar feedback</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              ¿Algo que no funciona? ¿Una idea? ¿Algo que te encanta? Cuéntanos.
            </p>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Escribe aquí tu mensaje..."
              rows={4}
              autoFocus
              className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-green-select mb-4"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl py-2.5 text-sm">
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={!mensaje.trim() || enviando}
                className="flex-1 bg-green-select text-white rounded-xl py-2.5 text-sm font-bold hover:bg-green-600 disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
