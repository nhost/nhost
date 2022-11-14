import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Determines the vertical margin of the divider.
   *
   * @default 'high'
   */
  spacing?: 'low' | 'medium' | 'high';
  /**
   * Arbitrary classnames to be added to the divider.
   *
   */
  className?: string;
}

export function Divider({ spacing = 'high', className }: DividerProps) {
  return (
    <div
      className={clsx(
        'order-3 mx-auto h-[0.25px] w-full self-stretch bg-verydark opacity-20',
        spacing === 'low' && 'my-12',
        spacing === 'medium' && 'my-16',
        spacing === 'high' && 'my-20',
        className,
      )}
    />
  );
}
