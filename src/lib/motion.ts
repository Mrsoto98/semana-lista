// Shared Framer Motion variants for consistent animations across the app

export const pageVariants = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0 },
  exit:     { opacity: 0, y: -4 },
}

export const pageTransition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
}

export const listContainerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}

export const listItemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } },
}

export const cardHover = {
  whileHover: { scale: 1.01, y: -1 },
  whileTap:   { scale: 0.98 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

export const springScale = {
  type: 'spring',
  stiffness: 400,
  damping: 20,
}

export const heartVariants = {
  idle:    { scale: 1 },
  liked:   { scale: [1, 1.35, 0.9, 1], transition: { duration: 0.4 } },
}

export const slideUpVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

export const scaleInVariants = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
}

export const drawerVariants = {
  hidden:  { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit:    { y: '100%', opacity: 0, transition: { duration: 0.2 } },
}

export const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}
