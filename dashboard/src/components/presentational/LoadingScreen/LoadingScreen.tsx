import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Spinner } from '@/components/ui/v3/spinner';

export type LoadingScreenProps = ComponentPropsWithoutRef<'div'>;

export default function LoadingScreen({
  className,
  ...props
}: LoadingScreenProps) {
  return (
    <div
      className={twMerge(
        'box absolute top-0 right-0 bottom-0 left-0 z-50 flex h-full w-full items-center justify-center',
        className,
      )}
      {...props}
    >
      <Spinner className="h-5 w-5" />
    </div>
  );
}
