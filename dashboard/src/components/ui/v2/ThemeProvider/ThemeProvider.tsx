import { ColorPreferenceProvider } from '@/components/ui/v2/ColorPreferenceProvider';
import { createTheme } from '@/components/ui/v2/createTheme';
import { useColorPreference } from '@/components/ui/v2/useColorPreference';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider as MaterialThemeProvider } from '@mui/material/styles';
import Head from 'next/head';
import type { PropsWithChildren } from 'react';

function ThemeProviderContent({
  children,
  color: manualColor,
}: PropsWithChildren<{ color?: 'light' | 'dark' }>) {
  const { color } = useColorPreference();
  const theme = createTheme(manualColor || color);

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

      {children}
    </MaterialThemeProvider>
  );
}

export interface ThemeProviderProps extends PropsWithChildren<unknown> {
  /**
   * The key used to store the color preference in the local storage.
   *
   * @default 'color-mode'
   */
  colorPreferenceStorageKey?: string;
  /**
   * Manually set the color preference.
   */
  color?: 'light' | 'dark';
}

function ThemeProvider({
  children,
  color,
  colorPreferenceStorageKey = 'color-preference',
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
