import type { PaletteMode, PaletteOptions } from '@mui/material';

export default function getDesignTokens(mode: PaletteMode): PaletteOptions {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      primary: {
        light: '#ebf3ff',
        main: '#3888ff',
        dark: '#063799',
      },
      text: {
        primary: '#dfecf5',
        secondary: '#a2b3be',
        disabled: '#363a43',
      },
      error: {
        light: '#ff5c7a',
        main: '#f13154',
        dark: '#c91737',
      },
      action: {
        hover: '#21262D',
        active: '#21262D',
        focus: '#21262D',
        disabled: '#363a43',
      },
      grey: {
        100: '#10151e',
        200: '#21262d',
        300: '#2f363d',
        400: '#363a43',
        500: '#8b949e',
        600: '#a2b3be',
        700: '#dfecf5',
        800: '#f8fcff',
        900: '#ffffff',
      },
      background: {
        default: '#151a22',
        paper: '#171d26',
      },
      divider: '#21262d',
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
      200: '#F4F7F9',
      300: '#eaedf0',
      400: '#C2CAD6',
      500: '#9CA7B7',
      600: '#556378',
      700: '#21324b',
      800: '#0e1827',
      900: '#000000',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    divider: '#eaedf0',
  };
}
