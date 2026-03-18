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
        // Single source of truth: edit globals.css :root variables only.

        // PRIMARY: Deep Navy
        navy: {
          900: 'var(--color-navy-900)',
          800: 'var(--color-navy-800)',
          700: 'var(--color-navy-700)',
          600: 'var(--color-navy-600)',
        },

        // SECONDARY: Cobalt Blue (actions, buttons, focus)
        cobalt: {
          DEFAULT: 'var(--color-cobalt)',
          hover:   'var(--color-cobalt-hover)',
          light:   'var(--color-cobalt-light)',
          soft:    'var(--color-cobalt-soft)',
        },

        // ACCENT: Analytical Teal (data, accuracy, results — use sparingly)
        teal: {
          DEFAULT: 'var(--color-teal)',
          hover:   'var(--color-teal-hover)',
          soft:    'var(--color-teal-soft)',
        },

        // NEUTRALS
        mist:             'var(--color-mist)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-subtle':    'var(--color-text-subtle)',

        // Legacy alias kept for backward compat
        primary: 'var(--color-cobalt)',
        sidebar: {
          bg:     'var(--color-navy-900)',
          hover:  'var(--color-navy-800)',
          active: 'var(--color-navy-700)',
          text:   'var(--color-mist)',
          muted:  'var(--color-text-secondary)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
