import type { PaletteMode } from '@mui/material';
import type { PaletteOptions } from '@mui/material/styles';

export default function getDesignTokens(mode: PaletteMode): PaletteOptions {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      primary: {
        light: '#1b2534',
        main: '#3888ff',
        dark: '#063799',
      },
      secondary: {
        100: '#21262d',
        200: '#252b33',
        300: '#37404b',
        400: '#44505e',
        500: '#576473',
        600: '#6e7c8d',
        700: '#8595a9',
        800: '#a4b2c2',
        A400: '#576473',
      },
      text: {
        primary: '#dfecf5',
        secondary: '#a2b3be',
        disabled: '#68717a',
      },
      error: {
        light: 'rgba(241, 49, 84, 0.2)',
        main: '#f13154',
        dark: '#c91737',
      },
      warning: {
        light: 'rgba(255, 154, 35, 0.2)',
        main: '#ff9a23',
        dark: '#ed7200',
      },
      success: {
        light: 'rgba(98, 209, 152, 0.2)',
        main: '#62d198',
        dark: '#3bb174',
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
      divider: '#2f363d',
      beige: {
        main: '#362c22',
      },
    };
  }

  return {
    primary: {
      light: '#ebf3ff',
      main: '#0052cd',
      dark: '#063799',
    },
    secondary: {
      100: '#f4f7f9',
      200: '#e6eaef',
      300: '#d8dfe7',
      400: '#ccd4de',
      500: '#bfcad5',
      600: '#b4c0ce',
      700: '#a9b6c7',
      800: '#a0aec0',
      A400: '#bfcad5',
    },
    text: {
      primary: '#21324b',
      secondary: '#556378',
      disabled: '#9ca7b7',
    },
    success: {
      light: 'rgba(170, 240, 204, 0.3)',
      main: '#62d198',
      dark: '#3bb174',
    },
    error: {
      light: '#ffe4de',
      main: '#f13154',
      dark: '#c91737',
    },
    warning: {
      light: 'rgba(255, 154, 35, 0.2)',
      main: '#ff9a23',
      dark: '#ed7200',
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
      400: '#c2cad6',
      500: '#9ca7b7',
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
    beige: {
      main: '#e5d1bf',
    },
  };
}
