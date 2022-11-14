import clsx from 'clsx';
import type { DetailedHTMLProps, HTMLProps } from 'react';

export interface FloatingActionButtonProps
  extends DetailedHTMLProps<HTMLProps<HTMLButtonElement>, HTMLButtonElement> {}

export default function FloatingActionButton({
  children,
  className,
  type,
  ...props
}: FloatingActionButtonProps) {
  return (
    <button
      className={clsx(
        'flex h-11 w-11 items-center justify-center truncate rounded-full bg-blue text-white shadow-raised-2 focus:ring-2 focus:ring-blue focus:ring-offset-2',
        className,
      )}
      type={type === 'submit' ? 'submit' : 'button'}
      {...props}
    >
      {children}
    </button>
  );
}
