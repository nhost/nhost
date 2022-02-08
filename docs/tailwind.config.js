const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  mode: 'jit',
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-2': 'var(--primary-2)',
        secondary: 'var(--secondary)',
        'secondary-2': 'var(--secondary-2)',
        hover: 'var(--hover)',
        'hover-1': 'var(--hover-1)',
        'hover-2': 'var(--hover-2)',
        'accent-0': 'var(--accent-0)',
        'accent-1': 'var(--accent-1)',
        'accent-2': 'var(--accent-2)',
        'accent-3': 'var(--accent-3)',
        'accent-4': 'var(--accent-4)',
        'accent-5': 'var(--accent-5)',
        'accent-6': 'var(--accent-6)',
        'accent-7': 'var(--accent-7)',
        'accent-8': 'var(--accent-8)',
        'accent-9': 'var(--accent-9)',
        grayscale: 'rgb(156, 167, 183)',
        violet: 'var(--violet)',
        lightGray: 'hsl(210deg,14%,66%)',
        'violet-light': 'var(--violet-light)',
        'violet-dark': 'var(--violet-dark)',
        pink: 'var(--pink)',
        hardpink: '#ff117d',
        'pink-light': 'var(--pink-light)',
        cyan: 'var(--cyan)',
        blue: 'var(--blue)',
        darkBlue: '#003caa',
        green: 'var(--green)',
        greenDark: 'var(--green-dark)',
        dimgreen: '#AAF0CC4D',
        veryLightGray: '#F4F7F9',
        red: 'var(--red)',
        header: '#F4F7F9',
        nav: '#21324B',
        greyscaleGrey: '#9CA7B7',
        box: 'rgba(55, 135, 255, 0.15)',
        btn: '#0052CD',
        greyscaleDark: '#21324B',
        secondary: '#9CA7B7',
        add: '#14242D',
        input: '#C2CAD6',
        picker: 'rgba(33, 50, 75, 1)',
        divide: 'rgba(0, 35, 88, 0.16)',
        dark: 'rgba(20, 36, 45, 1)',
        fafafa: '#fafafa',
        ish: '#f6f9fc',
        discord: '#5865f2',
        header: '#F4F7F9',
        nav: '#21324B',
        box: 'rgba(55, 135, 255, 0.15)',
        btn: '#0052CD',
        btnDark: '#21324b',
        secondary: '#9CA7B7',
        add: '#14242D',
        input: '#C2CAD6',
        under: '#263245',
        blueHero: '#0052CD',
        box: 'rgba(55, 135, 255, 0.15)',
        boxContent: 'rgba(33, 50, 75, 1)',
        readMore: 'rgba(0, 82, 205, 1)',
        verydark: '#0E1827',
        pinklight: '#E535AB33',
        blueFeat: '#0052CD26',
        yellowf: '#FF9A2333'
      },
      textColor: {
        base: 'var(--text-base)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)'
      },
      lineHeight: {
        hero: '61.6px',
        hero2: '70px'
      },
      width: {
        side: '544px',
        feat: '312px',
        nav: '260px',
        features: '429px',
        frameworks: '880px',
        tablet: '720px',
        body: '836px',
        header: '1440px',
        plan: '200px',
        pricing: '348px',
        box: '409px',
        body: '836px',
        nav: '260px',
        container: '1184px'
      },
      minWidth: {
        frameworks: '880px',
        features: '429px',
        feat: '312px',
        side: '480px',
        nav: '260px',
        tablet: '720px',
        body: '836px',
        header: '1440px',
        container: '1184px'
      },
      maxWidth: {
        body: '836px',
        side: '480px',
        feat: '312px',
        frameworks: '880px',
        nav: '230px',
        features: '429px',
        tablet: '720px',
        box: '409px',
        hero: '800px',
        '4.5xl': '60rem',
        '8xl': '85rem',
        features: '579px',
        cta: '1360px',
        plans: '1068px',
        infra: '1120px',
        mxcontainer: '1200px',
        header: '1440px',
        header2: '1424px',
        container: '1184px'
      },

      height: {
        usecase: '674px',
        footer: '473px'
      },
      borderRadius: {
        'sm+': '4px'
      },
      fontSize: {
        'base-': '15px',
        '2.5xl': '26px',
        pricing: '56px'
      },
      fontFamily: {
        display: ['Inter', ...defaultTheme.fontFamily.sans],
        'inter-var': ['Inter var', ...defaultTheme.fontFamily.sans],
        system: defaultTheme.fontFamily.sans,
        flow: 'Flow'
      },

      margin: {
        2.5: '10px',
        4.5: '18px'
      },
      padding: {
        0.25: '0.075rem',
        1.6: '7px',
        2.5: '11px'
      }
    }
  },
  variants: {
    extend: {}
  },
  plugins: []
}
