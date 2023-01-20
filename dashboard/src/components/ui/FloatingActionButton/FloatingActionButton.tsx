import type { IconButtonProps } from '@/ui/v2/IconButton';
import IconButton from '@/ui/v2/IconButton';
import clsx from 'clsx';

export interface FloatingActionButtonProps extends IconButtonProps {}

export default function FloatingActionButton({
  children,
  className,
  type,
  ...props
}: FloatingActionButtonProps) {
  return (
    <IconButton
      className={clsx(
        'flex h-11 w-11 items-center justify-center truncate rounded-full',
        className,
      )}
      type={type === 'submit' ? 'submit' : 'button'}
      {...props}
    >
      {children}
    </IconButton>
  );
}
