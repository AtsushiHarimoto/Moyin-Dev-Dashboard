/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wiki Design Tokens
        "primary": "var(--color-sakura-pink)",
        "primary-glow": "var(--color-sakura-glow)",
        "background-dark": "var(--color-bg-dark)",
        "surface-dark": "var(--color-smoke-purple)",
        "surface-glass": "var(--color-glass-bg)",
        
        // Sakura Brand Colors
        'sakura-pink': 'var(--color-sakura-pink)',
        'petal-pink': 'var(--color-petal-pink)',
        'mist-purple': 'var(--color-mist-purple)',
        'twilight-purple': 'var(--color-twilight-purple)',
        'dark-purple': 'var(--color-dark-purple)',
        'moonlight': 'var(--color-moonlight)',
        'morning-mist': 'var(--color-morning-mist)',
        'smoke-purple': 'var(--color-smoke-purple)',
      },
      fontFamily: {
        sans: ['JF Open Huninn', 'M PLUS Rounded 1c', 'Inter', 'Noto Sans TC', 'system-ui', 'sans-serif'],
        serif: ['Noto Serif TC', 'Noto Serif SC', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'neon': '0 0 5px theme("colors.primary"), 0 0 20px theme("colors.primary")',
        'neon-sm': '0 0 2px theme("colors.primary"), 0 0 10px theme("colors.primary")',
      },
      animation: {
        'breathing-glow': 'breathing-glow 3s infinite ease-in-out',
      },
      keyframes: {
        'breathing-glow': {
          '0%, 100%': { boxShadow: '0 0 20px var(--shadow-sakura)' },
          '50%': { boxShadow: '0 0 40px var(--shadow-sakura)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
