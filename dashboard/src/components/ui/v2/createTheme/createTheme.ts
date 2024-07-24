import { getDesignTokens } from '@/components/ui/v2/theme/getDesignTokens';
import type { PaletteMode } from '@mui/material';
import { createTheme as createMuiTheme } from '@mui/material/styles';

/**
 * Creates a Material UI theme for the specified color mode.
 *
 * @param mode - Color mode
 * @returns Material UI theme
 */

declare module '@mui/material/styles' {
  interface Palette {
    beige: Palette['primary'];
  }

  interface PaletteOptions {
    beige?: PaletteOptions['primary'];
  }
}

export default function createTheme(mode: PaletteMode) {
  return createMuiTheme({
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
        lineHeight: '2.375rem',
        fontWeight: 500,
      },
      h3: {
        fontSize: '1.125rem',
        lineHeight: '1.5rem',
        fontWeight: 500,
      },
      h4: {
        fontSize: '1rem',
        lineHeight: '1.375rem',
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
    palette: getDesignTokens(mode),
  });
}
