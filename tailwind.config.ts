import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080808',
        rhyme: {
          yellow:     '#ffd447',
          blue:       '#3aa3ff',
          orange:     '#ff8a3c',
          red:        '#e44d4d',
          'cyan-from': '#5ec8ff',
          'cyan-to':   '#2860e0',
        },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
