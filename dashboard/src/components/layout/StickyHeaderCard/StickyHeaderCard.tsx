import * as React from 'react';
import { cn } from '@/lib/utils';

const StickyHeaderCard = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  // Not a SettingsCard: that clips its content, which would stop the header
  // from sticking. Same border and radius, so it reads like the other cards.
  // min-w-0: wide content scrolls inside the card instead of stretching the
  // page.
  <section
    ref={ref}
    className={cn('min-w-0 rounded-lg border', className)}
    {...props}
  />
));
StickyHeaderCard.displayName = 'StickyHeaderCard';

export { StickyHeaderCard };
