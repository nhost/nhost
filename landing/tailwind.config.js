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
        25: '6.25rem',
      },
      fontFamily: {
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
        mona: ['"Mona Sans"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
