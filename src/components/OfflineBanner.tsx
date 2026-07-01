import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-400 text-yellow-900 text-xs font-semibold text-center py-1.5 px-4">
      Sin conexión — algunos cambios no se guardarán hasta que vuelvas a estar online
    </div>
  )
}
