/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- DAATAN COLOR SYSTEM ---

        // PRIMARY: Deep Navy
        navy: {
          900: '#0B1F33', // main background
          800: '#0E263D', // hover / variation
          700: '#132C45', // light surface / cards
          600: '#1C3A5A', // subtle borders
        },

        // SECONDARY: Cobalt Blue (actions, buttons, focus)
        cobalt: {
          DEFAULT: '#2F6BFF',
          hover:   '#2459D6',
          light:   '#5B8CFF',
          soft:    '#EAF1FF',
        },

        // ACCENT: Analytical Teal (data, accuracy, results — use sparingly)
        teal: {
          DEFAULT: '#2EC4B6',
          hover:   '#25A798',
          soft:    '#E6FAF8',
        },

        // NEUTRALS
        mist:    '#E6E9EF',
        'text-secondary': '#A0AEC0',
        'text-subtle':    '#6B7280',

        // Legacy alias kept for backward compat
        primary: '#2F6BFF',
        sidebar: {
          bg:     '#0B1F33',
          hover:  '#0E263D',
          active: '#132C45',
          text:   '#E6E9EF',
          muted:  '#A0AEC0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
