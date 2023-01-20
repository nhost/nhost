import getDesignTokens from '@/theme/getDesignTokens';
import type { PaletteMode } from '@mui/material';
import { createTheme as createMuiTheme } from '@mui/material/styles';

/**
 * Creates a Material UI theme for the specified color mode.
 *
 * @param mode - Color mode
 * @returns Material UI theme
 */
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
