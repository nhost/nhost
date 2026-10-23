import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

// One row in a feature sidebar list (tables, buckets, functions, actions,
// triggers, remote schemas). The row holds the item's link and, on most
// lists, its three dots menu. selected gives the open item its background.
// The classes match what the old Button (link variant) wrapper resolved to,
// icon sizing included, so the rows look the same. There is deliberately no
// text color: the old wrapper's `text-primary` never applied, because
// tailwind-merge reads `text-sm+` as a text color and dropped `text-primary`
// (cn('text-primary …', '… text-sm+ …') keeps only text-sm+). The rows have
// always inherited the normal text color; selected items set their own.
const sidebarListRowVariants = cva(
  'flex w-full max-w-full items-center justify-between whitespace-nowrap rounded-md pl-0 font-medium text-sm+ ring-offset-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [:where(&_svg)]:size-4',
  {
    variants: {
      size: {
        // One line of text.
        default: 'h-9 pr-3',
        // Two lines of text (Functions: route and path).
        auto: 'h-auto py-2 pr-4',
      },
      selected: {
        true: 'bg-table-selected',
        false: '',
      },
    },
    defaultVariants: {
      size: 'default',
      selected: false,
    },
  },
);

export interface SidebarListRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  selected?: boolean;
  size?: 'default' | 'auto';
  /** Passed through as is; kept from the old Button wrapper. */
  disabled?: boolean;
}

const SidebarListRow = React.forwardRef<HTMLDivElement, SidebarListRowProps>(
  ({ className, asChild = false, selected = false, size, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        ref={ref}
        className={cn(sidebarListRowVariants({ size, selected }), className)}
        {...props}
      />
    );
  },
);
SidebarListRow.displayName = 'SidebarListRow';

export { SidebarListRow, sidebarListRowVariants };
