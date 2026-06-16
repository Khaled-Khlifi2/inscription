/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
      },
      colors: {
        ink:   { DEFAULT: '#0D1117', soft: '#1C2333', muted: '#30374A' },
        steel: '#4A5568',
        mist:  '#8896A8',
        fog:   '#C8D0DC',
        ghost: '#EDF0F4',
        brand: {
          DEFAULT: '#1A56DB',
          dark:    '#1040B0',
          soft:    '#EBF2FF',
          glow:    'rgba(26,86,219,0.15)',
        },
        success: { DEFAULT: '#0D9488', soft: '#F0FDF9' },
        warn:    { DEFAULT: '#D97706', soft: '#FFFBEB' },
        danger:  { DEFAULT: '#DC2626', soft: '#FEF2F2' },
      },
      boxShadow: {
        xs:    '0 1px 2px rgba(13,17,23,0.06)',
        sm:    '0 2px 8px rgba(13,17,23,0.08), 0 1px 2px rgba(13,17,23,0.04)',
        md:    '0 4px 16px rgba(13,17,23,0.10), 0 2px 4px rgba(13,17,23,0.06)',
        lg:    '0 12px 40px rgba(13,17,23,0.14), 0 4px 12px rgba(13,17,23,0.08)',
        brand: '0 4px 20px rgba(26,86,219,0.30)',
      },
      keyframes: {
        fadeUp:  { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        spin:    { to: { transform: 'rotate(360deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-up':  'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':  'fadeIn 0.25s ease both',
        'spin-fast':'spin 0.7s linear infinite',
        shimmer:    'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
// appended — already complete above
