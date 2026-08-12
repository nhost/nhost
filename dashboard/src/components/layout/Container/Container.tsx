import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Class name passed to the root element.
   */
  rootClassName?: string;
}

export default function Container({
  children,
  className,
  rootClassName,
  ...props
}: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full', rootClassName)} {...props}>
      <div className={cn('mx-auto max-w-7xl px-5 py-4', className)}>
        {children}
      </div>
    </div>
  );
}
