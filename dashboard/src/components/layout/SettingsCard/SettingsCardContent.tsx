import type * as React from 'react';
import { cn } from '@/lib/utils';

const SettingsCardContent = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
}) => (
  <div
    ref={ref}
    className={cn('grid grid-flow-row gap-4 px-6', className)}
    {...props}
  />
);

export { SettingsCardContent };
