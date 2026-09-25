export function useHaptics() {
  const tap       = () => navigator.vibrate?.(10)
  const longPress = () => navigator.vibrate?.(14)
  const success   = () => navigator.vibrate?.([10, 60, 10])
  const warning   = () => navigator.vibrate?.([20, 60, 20])
  return { tap, longPress, success, warning }
}
