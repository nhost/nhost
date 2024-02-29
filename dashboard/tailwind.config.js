const defaultTheme = require('tailwindcss/defaultTheme');
const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/features/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    screens: {
      xs: '415px',
      'xs+': '515px',
      ...defaultTheme.screens,
    },
    extend: {
      colors: {
        github: '#24292E;',
        brown: '#382D22',
        copper: '#DD792D',
        paper: '#171d26',
        divider: '#2f363d',
        'primary-main': '#0052cd',
        'primary-light': '#ebf3ff',
        'primary-dark': '#063799',
      },
      boxShadow: {
        outline: 'inset 0 0 0 2px rgba(0, 82, 205, 0.6)',
        'outline-dark': 'inset 0 0 0 2px rgba(0, 82, 205, 1)',
      },
      zIndex: {
        '-1': '-1',
      },
      divideWidth: {
        1: '1px',
      },
      borderWidth: {
        1: '1px',
      },
      lineHeight: {
        6.5: '22px',
        login: '61.6px',
      },
      margin: {
        14.5: '61px',
        18: '72px',
        loader: '500px',
      },
      spacing: {
        4.5: '1.2rem',
        13: '3.25rem',
        17: '4.25rem',
        18: '4.5rem',
        25: '6.25rem',
        27: '6.75rem',
      },
      height: {
        3.3: '0.86rem',
        3.7: '15px',
        4.5: '18px',
        5.5: '22px',
        13.5: '52px',
        120: '30rem',
        modal: '361px',
        modal2: '330px',
        import: '348px',
        terminal: '240px',
        'near-screen': '96.5vh',
      },
      borderRadius: {
        'sm+': '4px',
      },
      width: {
        3.3: '0.85rem',
        3.7: '15px',
        4.5: '18px',
        form: '200px',
        conn: '190px',
        label: '240px',
        drop: '280px',
        input: '344px',
        settings: '388px',
        98: '400px',
        selector2: '460px',
        'modal-': '430px',
        modal: '480px',
        modal2: '428px',
        front: '491px',
        feedback: '432px',
        miniModal: '384px',
        welcome: '640px',
        account: '344px',
        app: '896px',
        workspaceSidebar: '320px',
        apps: '928px',
        dash: '1376px',
        info: '494px',
        selector: '400px',
        deploy: '548px',
        func: '712px',
        func0: '660px',
        drop2: '440px',
        newApps: '544px',
        elem: '271px',
        centImage: '72px',
        textModal: '350px',
      },
      minWidth: {
        38: '9.5rem',
        dash: '1376px',
        apps: '928px',
        '2.5xl': '720px',
      },
      minHeight: {
        38: '9.5rem',
      },
      paddingLeft: {
        'pl-1.5': '7px',
      },
      fontSize: {
        'xs-': ['0.6875rem', '0.875rem'],
        'sm-': ['0.8125rem', '1rem'],
        'sm+': ['0.9375rem', '1.25rem'],
        '3.5xl': ['2rem', '2.5rem'],
        '4.5xl': ['2.5rem', '2.5rem'],
      },
      maxWidth: {
        2: '0.5rem',
        sidebar: '15rem',
        dash: '1376px',
        header: '1424px',
        apps: '928px',
        box: '409px',
        app: '896px',
        '2.5xl': '720px',
        hero: '800px',
        '4.5xl': '60rem',
        '8xl': '85rem',
        '8.4xl': '1424px',
        '8.5xl': '1444px',
        '9xl': '1600px',
        qhd: '2560px',
        features: '579px',
      },
      maxHeight: {
        'near-screen': '96vh',
        120: '30rem',
      },
      fontFamily: {
        display: ['Inter var', ...defaultTheme.fontFamily.sans],
        sans: ['Work Sans', ...defaultTheme.fontFamily.sans],
        system: defaultTheme.fontFamily.sans,
        'inter-var': ['Inter var', ...defaultTheme.fontFamily.sans],
        mono: ['"Roboto Mono"', ...defaultTheme.fontFamily.mono],
      },
      keyframes: {
        blinking: {
          '0%': { opacity: 0 },
          '50%': { opacity: 1 },
          '100%': { opacity: 0 },
        },
        toastenter: {
          '0%': { transform: 'scale(0.9)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        toastleave: {
          '0%': { transform: 'scale(1)', opacity: 1 },
          '100%': { transform: 'scale(0.9)', opacity: 0 },
        },
      },
      animation: {
        blinking: 'blinking 1s infinite',
        toastenter: 'enter 200ms ease-out',
        toastleave: 'leave 150ms ease-in forwards',
      },
    },
  },
  variants: {
    extend: {},
  },
  // eslint-disable-next-line global-require
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    plugin(({ matchUtilities, theme }) => {
      matchUtilities(
        {
          'animate-delay': (value) => ({
            animationDelay: value,
          }),
        },
        { values: theme('transitionDelay') },
      );
    }),
  ],
};
