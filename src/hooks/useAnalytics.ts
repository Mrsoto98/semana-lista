import { useCallback } from 'react'
import { useAuth } from './useAuth'

type Evento =
  | 'menu_generado'
  | 'menu_sorpresa'
  | 'menu_nevera'
  | 'slot_regenerado'
  | 'receta_favorita'
  | 'receta_dislike'
  | 'lista_abierta'
  | 'exportar_pdf'
  | 'exportar_clipboard'
  | 'exportar_link'
  | 'feedback_enviado'
  | 'onboarding_completado'

export function useAnalytics() {
  const { user } = useAuth()

  const track = useCallback(async (evento: Evento, propiedades?: Record<string, unknown>) => {
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('eventos').insert({
        usuario_id: user?.id ?? null,
        evento,
        propiedades: propiedades ?? {},
      })
    } catch {
      // analytics nunca deben romper la app
    }
  }, [user])

  return { track }
}
