import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider as MaterialThemeProvider } from '@mui/material/styles';
import Head from 'next/head';
import { type PropsWithChildren, useEffect } from 'react';
import { ColorPreferenceProvider } from '@/components/ui/v2/ColorPreferenceProvider';
import { createTheme } from '@/components/ui/v2/createTheme';
import { useColorPreference } from '@/components/ui/v2/useColorPreference';
import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/constants/common';

function ThemeProviderContent({
  children,
  color: manualColor,
}: PropsWithChildren<{ color?: 'light' | 'dark' }>) {
  const { color: preferredColor } = useColorPreference();
  const theme = createTheme(manualColor || preferredColor);

  useEffect(() => {
    if (manualColor) {
      return;
    }

    const rootElement = document.documentElement;
    rootElement.classList.remove('light', 'dark');
    rootElement.classList.add(preferredColor);
  }, [preferredColor, manualColor]);

  return (
    <MaterialThemeProvider theme={theme}>
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
   * The key used to store the color preference in local storage.
   *
   * @default COLOR_PREFERENCE_STORAGE_KEY
   */
  colorPreferenceStorageKey?: string;
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
  colorPreferenceStorageKey = COLOR_PREFERENCE_STORAGE_KEY,
}: ThemeProviderProps) {
  return (
    <ColorPreferenceProvider
      colorPreferenceStorageKey={colorPreferenceStorageKey}
    >
      <ThemeProviderContent color={color}>{children}</ThemeProviderContent>
    </ColorPreferenceProvider>
  );
}

ThemeProvider.displayName = 'NhostThemeProvider';

export default ThemeProvider;
