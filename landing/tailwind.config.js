const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        '3.5xl': ['2rem', '2.5rem'],
        '4.5xl': ['2.5rem', '2.5rem'],
      },
      opacity: {
        7: '0.07',
        65: '0.65',
      },
      gridRow: {
        'span-7': 'span 7 / span 7',
        'span-8': 'span 8 / span 8',
        'span-15': 'span 15 / span 15',
      },
      colors: {
        divider: '#262626',
        default: '#080808',
        paper: '#111111',
        some: '#0052CD',
        'brand-light': '#8cc1f2',
        'brand-main': '#0066ff',
        'brand-dark': '#00398e',
      },
      spacing: {
        1.5: '0.375rem',
        3.5: '0.875rem',
        4.5: '1.125rem',
        18: '4.5rem',
        25: '6.25rem',
        26: '6.5rem',
        42: '10.5rem',
      },
      scale: {
        140: '1.4',
        200: '2',
        275: '2.75',
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-in-out forwards',
        'fade-in-delay': 'fade-in 0.5s ease-in-out forwards 0.1s',
        'slide-up': 'slide-up 0.15s ease-in-out forwards',
        'slide-middle-up': 'slide-middle-up 0.5s ease-in-out forwards',
        'translate-top-bottom':
          'translate-top-bottom 1.5s ease-in-out forwards',
        'slide-line-left-delay': 'slide-line-left 1s ease-in-out forwards 0.3s',
        'slide-line-up-delay': 'slide-line-up 1s ease-in-out forwards 0.3s',
        'bounce-right-left': 'bounce-right-left 1.5s ease-in-out infinite',
      },
      keyframes: {
        'slide-line-left': {
          '0%': { transform: 'translateX(0%)' },
          '50%': { transform: 'translateX(-210px)' },
          '100%': { transform: 'translateX(-200px)' },
        },
        'slide-line-up': {
          '0%': { transform: 'translateY(0%)' },
          '50%': { transform: 'translateY(-110px)' },
          '100%': { transform: 'translateY(-100px)' },
        },
        'slide-middle-up': {
          '0%': { transform: 'translateY(3%)', opacity: 0 },
          '50%': { opacity: 1 },
          '100%': { transform: 'translateY(0%)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: 0 },
          '50%': { opacity: 1 },
          '100%': { transform: 'translateY(0%)' },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'translate-top-bottom': {
          '0%': { transform: 'translateX(-75%)', opacity: 0 },
          '50%': { opacity: 1 },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-right-left': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(10px)' },
        },
      },
      boxShadow: {
        cover:
          '0px 0px 32px -10px rgba(0, 0, 0, 0.24), 0px 0px 32px 10px rgba(0, 0, 0, 0.25)',
      },
      transitionProperty: {
        highlight: 'background-color, color, opacity, box-shadow',
      },
      fontFamily: {
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
        mona: ['"Mona Sans"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
