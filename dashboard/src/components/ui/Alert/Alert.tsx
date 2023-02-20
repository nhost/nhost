import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

export interface AlertProps extends BoxProps {
  /**
   * Severity of the alert.
   *
   * @default 'info'
   */
  severity?: 'info' | 'success' | 'warning' | 'error';
}

export function Alert({
  severity = 'info',
  children,
  className,
  sx,
  ...props
}: AlertProps) {
  return (
    <Box
      className={twMerge(
        'rounded-sm+ bg-opacity-20 p-2 text-center text-sm+',
        className,
      )}
      sx={[
        ...(Array.isArray(sx) ? sx : [sx]),
        severity === 'error' && {
          backgroundColor: 'error.light',
          color: 'error.main',
        },
        severity === 'warning' && {
          backgroundColor: 'warning.light',
          color: 'warning.main',
        },
        severity === 'success' && {
          backgroundColor: 'success.light',
          color: 'success.main',
        },
        severity === 'info' && { backgroundColor: 'primary.light' },
      ]}
      {...props}
    >
      {children}
    </Box>
  );
}

export default Alert;
