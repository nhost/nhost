import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * The name of the setting or action.
   */
  title: React.ReactNode;
  /**
   * One line on what it does, under the title.
   */
  description?: React.ReactNode;
  /**
   * The button (or control) on the right.
   */
  action?: React.ReactNode;
}

/**
 * One action inside a settings card, like Pause or Transfer under
 * Availability: title and description on the left, the button on the right.
 * Stacked rows get a divider between them.
 */
const SettingsRow = React.forwardRef<HTMLDivElement, SettingsRowProps>(
  ({ className, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className="grid min-w-0 gap-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>

      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </div>
  ),
);
SettingsRow.displayName = 'SettingsRow';

export { SettingsRow };
