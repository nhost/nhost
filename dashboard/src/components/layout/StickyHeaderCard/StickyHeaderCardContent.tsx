import * as React from 'react';
import { cn } from '@/lib/utils';

const StickyHeaderCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  // Clips the corners without becoming a scroll container, so the page
  // scrolls under the sticky header and a CodeMirror search panel (Cmd+F) can
  // stick to the bottom of the window.
  <div
    ref={ref}
    className={cn('overflow-clip rounded-b-lg', className)}
    {...props}
  />
));
StickyHeaderCardContent.displayName = 'StickyHeaderCardContent';

export { StickyHeaderCardContent };
