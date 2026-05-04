/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07080A',
        'bg-secondary': '#0E1116',
        accent: '#00F0FF',
        'text-primary': '#F4F6F8',
        'text-secondary': '#A7B0B7',
        border: 'rgba(0,240,255,0.08)',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 16px rgba(0,240,255,0.18)',
        'glow-lg': '0 0 32px rgba(0,240,255,0.25)',
      },
      keyframes: {
        'slide-in-bottom': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 6px rgba(0,240,255,0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(0,240,255,0.8)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slide-in-bottom': 'slide-in-bottom 0.35s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
