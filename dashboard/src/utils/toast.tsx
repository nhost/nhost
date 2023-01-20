import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import createTheme from '@/ui/v2/createTheme';
import { ThemeProvider } from '@mui/material';
import clsx from 'clsx';
import type { ToastOptions } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { COLOR_PREFERENCE_STORAGE_KEY } from './CONSTANTS';

function getColor() {
  const colorPreference =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(COLOR_PREFERENCE_STORAGE_KEY)
      : 'light';
  const prefersDarkMode =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;

  if (colorPreference === 'system') {
    return prefersDarkMode ? 'dark' : 'light';
  }

  return colorPreference as 'light' | 'dark';
}

export function triggerToast(string: string) {
  const color = getColor();

  toast.custom((t) => (
    <ThemeProvider theme={createTheme(color)}>
      <Box
        className={clsx(
          'rounded-sm+ px-2 py-1.5 font-normal shadow-md',
          t.visible ? 'animate-enter' : 'animate-leave',
        )}
        sx={{
          color: 'common.white',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.400' : 'grey.700',
        }}
      >
        {string}
      </Box>
    </ThemeProvider>
  ));
}

export function showLoadingToast(message: string, opts?: ToastOptions) {
  const color = getColor();

  return toast.custom(
    ({ visible }) => (
      <ThemeProvider theme={createTheme(color)}>
        <Box
          className={clsx(
            'grid grid-flow-col gap-2 rounded-sm+ px-2 py-1.5 font-normal shadow-md',
            visible ? 'animate-enter' : 'animate-leave',
          )}
          sx={{
            color: 'common.white',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.400' : 'grey.700',
          }}
        >
          <ThemeProvider theme={createTheme('dark')}>
            <ActivityIndicator label={message} />
          </ThemeProvider>
        </Box>
      </ThemeProvider>
    ),
    opts,
  );
}
