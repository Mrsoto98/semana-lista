export interface ZodiacSign {
  name: string
  symbol: string
  emoji: string
}

export function getZodiac(birthDate: string | null | undefined): ZodiacSign | null {
  if (!birthDate) return null
  const parts = birthDate.split('-')
  if (parts.length < 3) return null
  const m = parseInt(parts[1])
  const d = parseInt(parts[2])
  if (isNaN(m) || isNaN(d)) return null

  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return { name: 'Capricornio', symbol: '♑', emoji: '🐐' }
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return { name: 'Acuario',     symbol: '♒', emoji: '🏺' }
  if ((m === 2 && d >= 19) || (m === 3 && d <= 20)) return { name: 'Piscis',      symbol: '♓', emoji: '🐟' }
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return { name: 'Aries',       symbol: '♈', emoji: '🐏' }
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return { name: 'Tauro',       symbol: '♉', emoji: '🐂' }
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return { name: 'Géminis',     symbol: '♊', emoji: '👯' }
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return { name: 'Cáncer',      symbol: '♋', emoji: '🦀' }
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return { name: 'Leo',         symbol: '♌', emoji: '🦁' }
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return { name: 'Virgo',       symbol: '♍', emoji: '🌾' }
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return { name: 'Libra',      symbol: '♎', emoji: '⚖️' }
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return { name: 'Escorpio',  symbol: '♏', emoji: '🦂' }
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return { name: 'Sagitario', symbol: '♐', emoji: '🏹' }
  return null
}
