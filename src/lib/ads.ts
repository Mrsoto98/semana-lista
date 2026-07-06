// src/lib/ads.ts — Servicio de anuncios unificado (web/AdSense + Android/AdMob)
import { Capacitor } from '@capacitor/core'

declare global {
  interface Window {
    adBreak?: (config: Record<string, unknown>) => void
  }
}

// ── IDs de prueba de Google — reemplazar por los reales cuando tengas AdMob ──
const ADMOB_REWARDED_ID_ANDROID = 'ca-app-pub-4112362316379237/1190824552'

export const esNativo = () => Capacitor.isNativePlatform()

let admobMod: typeof import('@capacitor-community/admob') | null = null

async function getAdMob() {
  if (!esNativo()) return null
  if (admobMod) return admobMod
  try {
    admobMod = await import('@capacitor-community/admob')
    return admobMod
  } catch {
    return null
  }
}

export function mostrarAnuncioRewardedWeb(): Promise<'recompensa' | 'cancelado' | 'error'> {
  return new Promise((resolve) => {
    if (!window.adBreak) { resolve('error'); return }
    window.adBreak({
      type: 'reward',
      name: 'generacion-menu',
      adDismissed: () => resolve('cancelado'),
      adViewed: () => resolve('recompensa'),
      beforeAd: () => {},
      afterAd: () => {},
      adBreakDone: (placementInfo: unknown) => {
        const info = placementInfo as { breakStatus?: string }
        if (info?.breakStatus && info.breakStatus !== 'viewed' && info.breakStatus !== 'dismissed') {
          resolve('error')
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
      const handles: ReturnType<typeof AdMob.addListener>[] = []

      function limpiar() { handles.forEach(h => h.then(r => r.remove())) }

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
