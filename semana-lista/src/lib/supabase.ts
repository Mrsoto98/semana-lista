// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const esNativoLocal = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  esNativoLocal ? { auth: { flowType: 'implicit' } } : {},
)
