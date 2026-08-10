import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider as MaterialThemeProvider } from '@mui/material/styles';
import Head from 'next/head';
import type { PropsWithChildren } from 'react';
import { createTheme } from '@/components/ui/v2/createTheme';
import {
  ThemeDocumentClass,
  ThemePreferenceProvider,
  useThemePreference,
} from '@/providers/Theme';
import { THEME_STORAGE_KEY } from '@/utils/constants/common';

function ThemeProviderContent({
  children,
  color: manualColor,
}: PropsWithChildren<{ color?: 'light' | 'dark' }>) {
  const { resolvedTheme } = useThemePreference();
  const theme = createTheme(manualColor || resolvedTheme);

  return (
    <MaterialThemeProvider theme={theme}>
      {!manualColor && <ThemeDocumentClass />}
      <CssBaseline />
      <GlobalStyles
        styles={{
          'html, body': {
            backgroundColor: `${theme.palette.background.default} !important`,
          },
        }}
      />
      <Head>
        <meta name="theme-color" content={theme.palette.background.paper} />
      </Head>
      {manualColor ? (
        <div className={`${manualColor} contents`}>{children}</div>
      ) : (
        children
      )}
    </MaterialThemeProvider>
  );
}

export interface ThemeProviderProps extends PropsWithChildren<unknown> {
  /**
   * The key used to store the theme preference in local storage.
   *
   * @default THEME_STORAGE_KEY
   */
  storageKey?: string;
  /**
   * Manually set the color preference. When set, the provider is scoped: it
   * themes only its own subtree (MUI theme plus a `light`/`dark` class on a
   * wrapper element for Tailwind tokens) and leaves the `<html>` class —
   * owned by the root provider in `_app.tsx` — untouched.
   */
  color?: 'light' | 'dark';
}

function ThemeProvider({
  children,
  color,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  return (
    <ThemePreferenceProvider storageKey={storageKey}>
      <ThemeProviderContent color={color}>{children}</ThemeProviderContent>
    </ThemePreferenceProvider>
  );
}

ThemeProvider.displayName = 'NhostThemeProvider';

export default ThemeProvider;
