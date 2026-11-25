import type * as React from 'react';
import { cn } from '@/lib/utils';

const SettingsCardFooter = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
}) => (
  <div
    ref={ref}
    // Marks the footer so SettingsCard can drop its bottom padding and let
    // this soft background run to the card's bottom edge.
    data-settings-card-footer=""
    className={cn(
      'mt-2 flex flex-col gap-4 bg-accent/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-2 dark:bg-muted/30',
      className,
    )}
    {...props}
  />
);

export { SettingsCardFooter };
