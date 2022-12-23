import clsx from 'clsx';
import type { DetailedHTMLProps, HTMLProps } from 'react';

export type ChipProps = DetailedHTMLProps<
  HTMLProps<HTMLDivElement>,
  HTMLDivElement
> & {
  /**
   * Determines chip color.
   *
   * @default 'default'
   */
  variant?: 'default' | 'info' | 'filled';
};

/**
 * @deprecated Use `@/ui/v2/Chip` instead.
 */
export default function Chip({
  variant = 'default',
  className,
  children,
}: ChipProps) {
  return (
    <span
      className={clsx(
        variant === 'default' && 'bg-gray-200 text-gray-700',
        variant === 'info' &&
          'bg-lightBlue bg-opacity-10 text-btn text-opacity-80',
        'inline-block rounded-full py-0.5 px-2 text-xs font-medium',
        variant === 'filled' && 'bg-blue text-white text-opacity-80',
        'inline-block rounded-[4px] py-1 px-1.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
