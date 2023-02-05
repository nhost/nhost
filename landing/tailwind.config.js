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
      },
      scale: {
        140: '1.4',
        200: '2',
        275: '2.75',
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
