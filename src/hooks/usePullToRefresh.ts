import { useRef, useState, useCallback } from 'react'

export const PTR_THRESHOLD = 72

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const active = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement
    if (el.scrollTop > 2 || refreshing) return
    startY.current = e.touches[0].clientY
    active.current = true
  }, [refreshing])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!active.current) return
    const delta = e.touches[0].clientY - startY.current
    if (delta < 0) { active.current = false; setPullY(0); return }
    setPullY(Math.min(PTR_THRESHOLD * 1.3, delta * 0.48))
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (!active.current) return
    active.current = false
    if (pullY >= PTR_THRESHOLD * 0.6) {
      setRefreshing(true)
      setPullY(0)
      try { await onRefresh() } finally { setRefreshing(false) }
    } else {
      setPullY(0)
    }
  }, [pullY, onRefresh])

  return { pullY, refreshing, onTouchStart, onTouchMove, onTouchEnd }
}
