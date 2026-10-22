import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

// A clickable row inside a menu that isn't a DropdownMenu (for example the
// account menu popover). Same size and spacing as DropdownMenuItem and the
// combobox rows. Destructive is the same row in the danger color.
const menuRowVariants = cva(
  'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'text-accent-foreground hover:bg-accent hover:text-accent-foreground',
        destructive:
          'text-destructive hover:bg-destructive-hover hover:text-destructive focus-visible:bg-destructive-hover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface MenuRowProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof menuRowVariants> {
  asChild?: boolean;
}

const MenuRow = React.forwardRef<HTMLButtonElement, MenuRowProps>(
  ({ className, variant, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? type : (type ?? 'button')}
        className={cn(menuRowVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
MenuRow.displayName = 'MenuRow';

export { MenuRow, menuRowVariants };
