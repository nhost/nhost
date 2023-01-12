import type { PaletteMode, PaletteOptions } from '@mui/material';

export default function getDesignTokens(mode: PaletteMode): PaletteOptions {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      primary: {
        light: '#ebf3ff',
        // light: 'rgba(56, 136, 255, 0.2)',
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
      action: {
        hover: '#f3f4f6',
        active: '#f3f4f6',
        focus: '#f3f4f6',
        disabled: '#C2CAD6',
      },
      grey: {
        100: '#ffffff',
        200: '#f4f7f9',
        300: '#eaedf0',
        400: '#c2cad6',
        500: '#9ca7b7',
        600: '#556378',
        700: '#21324b',
        800: '#0e1827',
        900: '#000000',
      },
      background: {
        default: '#0E1116',
        paper: '#0D0D0D',
      },
    };
  }

  return {
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
    background: {
      default: '#0E1116',
      paper: '#0D0D0D',
    },
  };
}
