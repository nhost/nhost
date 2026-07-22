import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsCardProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Render the card as its only child (e.g. a `<form>`) instead of a
   * `<section>`, so the form element becomes the card root.
   */
  asChild?: boolean;
}

const SettingsCard = React.forwardRef<HTMLElement, SettingsCardProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'section';

    return (
      <Comp
        ref={ref}
        className={cn(
          'grid grid-flow-row gap-4 overflow-hidden rounded-lg border py-4',
          className,
        )}
        {...props}
      />
    );
  },
);
SettingsCard.displayName = 'SettingsCard';

export { SettingsCard };
