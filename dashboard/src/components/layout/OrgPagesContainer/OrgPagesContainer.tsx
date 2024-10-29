import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

export interface ContainerProps {
  className?: string;
  rootClassName?: string;
  children: ReactNode;
}

export default function OrgPagesContainer({
  children,
  className,
  rootClassName,
}: ContainerProps) {
  return (
    <div className={cn('mx-auto h-full w-full bg-accent', rootClassName)}>
      <div className={cn('mx-auto max-w-7xl p-4', className)}>{children}</div>
    </div>
  );
}
