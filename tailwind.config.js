/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          900: '#04070f',
          800: '#070b17',
          700: '#0b1120',
          600: '#111a2e',
        },
        cyan: {
          glow: '#38f0ff',
        },
      },
      boxShadow: {
        glass: '0 8px 40px -12px rgba(0,0,0,0.9), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        glow: '0 0 24px -4px rgba(56,240,255,0.55)',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
        sweep: 'sweep 2.2s linear infinite',
        riseIn: 'riseIn 320ms cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
}
