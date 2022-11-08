import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface AlertProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
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
    <div
      className={twMerge(
        'rounded-sm+ bg-opacity-20 p-2 text-center text-sm+ text-greyscaleDark',
        severity === 'error' && 'bg-rose-500',
        severity === 'warning' && 'bg-yellow-500',
        severity === 'success' && 'bg-green-500',
        severity === 'info' && 'bg-lightBlue',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Alert;
