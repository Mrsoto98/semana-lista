import { motion } from 'framer-motion'

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const STARS = Array.from({ length: 42 }, (_, i) => ({
  x: seededRand(i * 2.3 + 1) * 100,
  y: seededRand(i * 3.7 + 2) * 100,
  s: seededRand(i * 1.1 + 3) * 1.6 + 0.4,
  dur: seededRand(i * 2.9 + 4) * 4 + 2.5,
  delay: seededRand(i * 1.7 + 5) * 6,
  opacity: seededRand(i * 3.1 + 6) * 0.35 + 0.12,
}))

export function CosmicBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Star field */}
      {STARS.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.s}px`,
            height: `${star.s}px`,
            background: 'rgba(255,255,255,0.9)',
            opacity: star.opacity,
            animation: `twinkle ${star.dur}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}

      {/* Primary accent orb — top left, theme-reactive */}
      <motion.div
        className="orb"
        style={{
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(var(--glow), 0.22) 0%, transparent 65%)',
          top: -160,
          left: -140,
        }}
        animate={{ x: [0, 50, -25, 0], y: [0, -35, 25, 0], scale: [1, 1.08, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Secondary teal orb — bottom right */}
      <motion.div
        className="orb"
        style={{
          width: 560,
          height: 560,
          background: 'radial-gradient(circle, rgba(100,212,184,0.15) 0%, transparent 70%)',
          bottom: -110,
          right: -110,
        }}
        animate={{ x: [0, -38, 18, 0], y: [0, 28, -32, 0], scale: [1, 0.93, 1.08, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />

      {/* Center soft orb */}
      <motion.div
        className="orb"
        style={{
          width: 460,
          height: 460,
          background: 'radial-gradient(circle, rgba(184,164,232,0.09) 0%, transparent 70%)',
          top: '38%',
          left: '28%',
        }}
        animate={{ x: [0, 30, -18, 0], y: [0, -22, 12, 0], scale: [1, 1.12, 0.90, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
      />

      {/* Top-right echo orb */}
      <motion.div
        className="orb"
        style={{
          width: 380,
          height: 380,
          background: 'radial-gradient(circle, rgba(var(--glow), 0.11) 0%, transparent 70%)',
          top: -60,
          right: -80,
        }}
        animate={{ x: [0, -22, 12, 0], y: [0, 20, -12, 0], scale: [1, 0.97, 1.06, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* Bottom-left warm accent orb */}
      <motion.div
        className="orb"
        style={{
          width: 340,
          height: 340,
          background: 'radial-gradient(circle, rgba(244,114,182,0.08) 0%, transparent 70%)',
          bottom: '18%',
          left: -70,
        }}
        animate={{ x: [0, 24, -14, 0], y: [0, -18, 8, 0], scale: [1, 1.05, 0.94, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 12 }}
      />

      {/* Deep void gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(8,8,16,0) 0%, rgba(8,8,16,0.35) 100%)',
        }}
      />
    </div>
  )
}
