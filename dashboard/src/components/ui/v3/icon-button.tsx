import type { ComponentType } from 'react';
import * as React from 'react';
import { dashboardNavItemIconClassName } from '@/components/layout/DashboardSidebar/DashboardSidebar';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

/**
 * A ghost, icon-only button with the app's standard hover treatment: no
 * background fill, the icon itself shifts to the primary blue on hover.
 * Centralizing this here means a future change to that hover behavior
 * only needs to happen in one place, not in every file that has an icon
 * button.
 */
export interface IconButtonProps
  extends Omit<ButtonProps, 'variant' | 'size'> {
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon: Icon, iconClassName, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn('group h-8 w-8 hover:bg-transparent', className)}
      {...props}
    >
      <Icon
        className={cn(
          'h-4 w-4 transition-colors group-hover:text-primary-main',
          dashboardNavItemIconClassName,
          iconClassName,
        )}
      />
      {children}
    </Button>
  ),
);
IconButton.displayName = 'IconButton';

export { IconButton };
