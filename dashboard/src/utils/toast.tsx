import createTheme from '@/theme/createTheme';
import Loading from '@/ui/Loading';
import Box from '@/ui/v2/Box';
import { ThemeProvider } from '@mui/material';
import clsx from 'clsx';
import type { ToastOptions } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { COLOR_MODE_STORAGE_KEY } from './CONSTANTS';

export function triggerToast(string: string) {
  const colorMode =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)
      : 'light';

  toast.custom((t) => (
    <ThemeProvider theme={createTheme(colorMode as 'dark' | 'light')}>
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
  const colorMode =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)
      : 'light';

  return toast.custom(
    ({ visible }) => (
      <ThemeProvider theme={createTheme(colorMode as 'dark' | 'light')}>
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
          <Loading color="white" />

          {message}
        </Box>
      </ThemeProvider>
    ),
    opts,
  );
}
