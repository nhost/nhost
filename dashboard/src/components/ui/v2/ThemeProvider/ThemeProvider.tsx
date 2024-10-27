import { ColorPreferenceProvider } from '@/components/ui/v2/ColorPreferenceProvider';
import { createTheme } from '@/components/ui/v2/createTheme';
import { useColorPreference } from '@/components/ui/v2/useColorPreference';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider as MaterialThemeProvider } from '@mui/material/styles';
import Head from 'next/head';
import { useEffect, type PropsWithChildren } from 'react';

function ThemeProviderContent({
  children,
  color: manualColor,
}: PropsWithChildren<{ color?: 'light' | 'dark' }>) {
  const { color: preferredColor } = useColorPreference();
  const theme = createTheme(manualColor || preferredColor);

  // Use effect to set the class on the root html tag
  useEffect(() => {
    const rootElement = document.documentElement;
    rootElement.classList.remove('light', 'dark'); // Remove previous classes
    rootElement.classList.add(preferredColor); // Add the current class
  }, [preferredColor]);

  return (
    <MaterialThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          'html, body': {
            backgroundColor: `${theme.palette.background.default} !important`,
          },
          html: {
            class: `${preferredColor}`,
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
   * The key used to store the color preference in local storage.
   *
   * @default 'color-preference'
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
