import * as React from 'react';
import { cn } from '@/lib/utils';

const SettingsCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('grid grid-flow-row gap-4 px-4', className)}
    {...props}
  />
));
SettingsCardContent.displayName = 'SettingsCardContent';

export { SettingsCardContent };
