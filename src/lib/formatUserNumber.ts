export function formatUserNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n <= 9999) return String(n).padStart(4, '0')
  // After 9999: A0001–A9999, B0001–B9999, ...
  const adjusted = n - 9999
  const letterIndex = Math.ceil(adjusted / 9999)
  const letter = String.fromCharCode(64 + letterIndex)
  const remainder = ((adjusted - 1) % 9999) + 1
  return letter + String(remainder).padStart(4, '0')
}
