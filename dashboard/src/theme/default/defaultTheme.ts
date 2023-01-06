import { createTheme } from '@mui/material';

/**
 * Default theme for the application.
 */
export const theme = createTheme({
  shape: {
    borderRadius: 4,
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    body1: {
      fontSize: '0.9375rem',
      lineHeight: '1.375rem',
    },
    h2: {
      fontSize: '1.625rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.125rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    subtitle1: {
      fontSize: '0.9375rem',
      lineHeight: '1.375rem',
    },
    subtitle2: {
      fontSize: '0.75rem',
    },
  },
  palette: {
    primary: {
      light: '#ebf3ff',
      main: '#0052cd',
      dark: '#063799',
    },
    text: {
      primary: '#21324b',
      secondary: '#556378',
      disabled: '#9ca7b7',
    },
    error: {
      light: '#ff5c7a',
      main: '#f13154',
      dark: '#c91737',
    },
    success: {
      main: 'rgba(170, 240, 204, 0.3)',
      contrastText: '#3BB174',
    },
    action: {
      hover: '#f3f4f6',
      active: '#f3f4f6',
      focus: '#f3f4f6',
      disabled: '#c2cad6',
    },
    grey: {
      100: '#ffffff',
      200: '#f4f7f9',
      300: '#eaedf0',
      400: '#e0e0e0',
      500: '#9ca7b7',
      600: '#556378',
      700: '#21324b',
      800: '#0e1827',
      900: '#000000',
    },
  },
  breakpoints: {
    // Using the same values as Tailwind CSS.
    // https://tailwindcss.com/docs/responsive-design#customizing-breakpoints
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
});

export default theme;
