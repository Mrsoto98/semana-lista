// src/lib/ads.ts — Servicio de anuncios unificado (web/AdSense + Android/AdMob)
// Los imports de Capacitor son dinámicos para que el build web no los necesite

declare global {
  interface Window {
    adBreak?: (config: Record<string, unknown>) => void
  }
}

const ADMOB_REWARDED_ID_ANDROID = 'ca-app-pub-4112362316379237/1190824552'

// Detecta si estamos en Android nativo sin importar Capacitor estáticamente
export function esNativo(): boolean {
  try {
    // En web esto no existe; en Capacitor sí
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(window as any).Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admobMod: any = null

async function getAdMob() {
  if (!esNativo()) return null
  if (admobMod) return admobMod
  try {
    // @ts-ignore — solo disponible en build Android
    admobMod = await import('@capacitor-community/admob')
    return admobMod
  } catch {
    return null
  }
}

export function mostrarAnuncioRewardedWeb(): Promise<'recompensa' | 'cancelado' | 'error'> {
  return new Promise((resolve) => {
    // Timeout de seguridad: si adBreak no responde en 6s, cancelar
    const timeout = setTimeout(() => resolve('cancelado'), 6000)
    const done = (result: 'recompensa' | 'cancelado' | 'error') => {
      clearTimeout(timeout)
      resolve(result)
    }

    if (!window.adBreak) { done('error'); return }
    window.adBreak({
      type: 'reward',
      name: 'generacion-menu',
      adDismissed: () => done('cancelado'),
      adViewed: () => done('recompensa'),
      beforeAd: () => {},
      afterAd: () => {},
      adBreakDone: (placementInfo: unknown) => {
        const info = placementInfo as { breakStatus?: string }
        // Si no hay anuncio disponible (cuenta pendiente de aprobación, etc.) cancelar
        if (info?.breakStatus && info.breakStatus !== 'viewed' && info.breakStatus !== 'dismissed') {
          done('cancelado')
        }
      },
    })
  })
}

export async function inicializarAdMob() {
  const mod = await getAdMob()
  if (!mod) return
  await mod.AdMob.initialize({ testingDevices: [], initializeForTesting: false })
}

export async function mostrarAnuncioRewarded(): Promise<'recompensa' | 'cancelado' | 'error'> {
  const mod = await getAdMob()
  if (!mod) return 'error'
  const { AdMob, RewardAdPluginEvents } = mod

  try {
    await AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_ID_ANDROID })

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handles: any[] = []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function limpiar() { handles.forEach((h: any) => h.then((r: any) => r.remove())) }

      handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        limpiar(); resolve('recompensa')
      }))
      handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        limpiar(); resolve('cancelado')
      }))
      handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
        limpiar(); resolve('error')
      }))

      AdMob.showRewardVideoAd()
    })
  } catch {
    return 'error'
  }
}
