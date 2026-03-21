import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'status-free': '#1a7f37',
        'status-working': '#bf8700',
        'status-waiting': '#cf222e',
        'status-active': '#0969da',
      }
    }
  },
  plugins: [typography],
} satisfies Config
