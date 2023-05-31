import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { createTheme } from '@/components/ui/v2/createTheme';
import { ThemeProvider } from '@mui/material';
import clsx from 'clsx';
import type { ToastOptions } from 'react-hot-toast';
import { toast } from 'react-hot-toast';
import getColor from './getColor';

export default function showLoadingToast(message: string, opts?: ToastOptions) {
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
