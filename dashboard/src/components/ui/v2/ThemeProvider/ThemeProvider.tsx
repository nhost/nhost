import ColorPreferenceProvider from '@/ui/v2/ColorPreferenceProvider';
import createTheme from '@/ui/v2/createTheme';
import useColorPreference from '@/ui/v2/useColorPreference';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider as MaterialThemeProvider } from '@mui/material/styles';
import type { PropsWithChildren } from 'react';

function ThemeProviderContent({ children }: PropsWithChildren<unknown>) {
  const { color, setColorPreference, colorPreferenceStorageKey } =
    useColorPreference();
  const theme = createTheme(color);

  return (
    <MaterialThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            backgroundColor: theme.palette.background.default,
          },
        }}
      />

      {children}

      {/* Temporary dark mode toggle button */}
      <div className="absolute bottom-0 right-0 z-[200000]">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(
                colorPreferenceStorageKey,
                color === 'dark' ? 'light' : 'dark',
              );
            }

            setColorPreference((currentPreference) =>
              currentPreference === 'dark' ? 'light' : 'dark',
            );
          }}
          className="bg-black text-white border-white border-1"
        >
          Toggle Dark Mode
        </button>
      </div>
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
}

function ThemeProvider({
  children,
  colorPreferenceStorageKey = 'color-preference',
}: ThemeProviderProps) {
  return (
    <ColorPreferenceProvider
      colorPreferenceStorageKey={colorPreferenceStorageKey}
    >
      <ThemeProviderContent>{children}</ThemeProviderContent>
    </ColorPreferenceProvider>
  );
}

ThemeProvider.displayName = 'NhostThemeProvider';

export default ThemeProvider;
