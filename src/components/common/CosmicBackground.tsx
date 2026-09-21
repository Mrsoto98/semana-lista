import { motion } from 'framer-motion'

export function CosmicBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Primary accent orb */}
      <motion.div
        className="orb"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(124,111,232,0.18) 0%, transparent 70%)',
          top: -120,
          left: -100,
        }}
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.08, 0.95, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Secondary orb — bottom right */}
      <motion.div
        className="orb"
        style={{
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(100,212,184,0.12) 0%, transparent 70%)',
          bottom: -80,
          right: -80,
        }}
        animate={{
          x: [0, -30, 15, 0],
          y: [0, 20, -25, 0],
          scale: [1, 0.95, 1.06, 1],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />

      {/* Tertiary orb — center subtle */}
      <motion.div
        className="orb"
        style={{
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(184,164,232,0.08) 0%, transparent 70%)',
          top: '40%',
          left: '35%',
        }}
        animate={{
          x: [0, 25, -15, 0],
          y: [0, -20, 10, 0],
          scale: [1, 1.1, 0.92, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
      />

      {/* Deep void gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(8,8,16,0) 0%, rgba(8,8,16,0.4) 100%)',
        }}
      />
    </div>
  )
}
