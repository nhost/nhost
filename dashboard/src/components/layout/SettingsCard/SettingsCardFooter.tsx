import * as React from 'react';
import { cn } from '@/lib/utils';

const SettingsCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-col gap-4 border-t px-4 pt-3.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2',
      className,
    )}
    {...props}
  />
));
SettingsCardFooter.displayName = 'SettingsCardFooter';

export { SettingsCardFooter };
