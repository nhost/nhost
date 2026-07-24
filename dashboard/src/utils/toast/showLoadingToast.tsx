import { ThemeProvider } from '@mui/material';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ToastOptions } from 'react-hot-toast';
import { toast } from 'react-hot-toast';
import { Box } from '@/components/ui/v2/Box';
import { createTheme } from '@/components/ui/v2/createTheme';
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
            <span className="flex flex-row items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">{message}</span>
            </span>
          </ThemeProvider>
        </Box>
      </ThemeProvider>
    ),
    opts,
  );
}
