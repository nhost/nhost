import createTheme from '@/ui/v2/createTheme';
import useColorMode from '@/ui/v2/useColorMode';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider as MaterialThemeProvider } from '@mui/material/styles';
import type { PropsWithChildren } from 'react';

export interface ThemeProviderProps extends PropsWithChildren<unknown> {
  /**
   * The key used to store the color mode in the localStorage.
   *
   * @default 'color-mode'
   */
  colorModeStorageKey?: string;
}

function ThemeProvider({
  children,
  colorModeStorageKey = 'color-mode',
}: ThemeProviderProps) {
  const [colorMode, setColorMode] = useColorMode({ colorModeStorageKey });

  const theme = createTheme(colorMode);

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
                colorModeStorageKey,
                colorMode === 'dark' ? 'light' : 'dark',
              );
            }

            setColorMode((currentMode) =>
              currentMode === 'dark' ? 'light' : 'dark',
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

ThemeProvider.displayName = 'NhostThemeProvider';

export default ThemeProvider;
