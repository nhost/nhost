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
  ...props
}: AlertProps) {
  return (
    <Box
      className={twMerge(
        'rounded-sm+ bg-opacity-20 p-2 text-center text-sm+',
        severity === 'error' && 'bg-rose-500',
        severity === 'warning' && 'bg-yellow-500',
        severity === 'success' && 'bg-green-500',
        severity === 'info' && 'bg-lightBlue',
        className,
      )}
      {...props}
    >
      {children}
    </Box>
  );
}

export default Alert;
