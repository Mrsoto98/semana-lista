// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'warm-white': '#FAFAF8',
        'green-select': '#4CAF50',
        'orange-accent': '#FF7043',
      },
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config
