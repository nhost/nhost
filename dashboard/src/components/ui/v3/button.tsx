import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // "Soft emboss" main CTA style, matching the Lovable reference design.
        default: 'btn-emboss btn-emboss-primary',
        // "Soft emboss" danger style, matching the Lovable reference design.
        destructive: 'btn-emboss btn-emboss-danger',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
        // "Soft emboss" secondary style, matching the Lovable reference design.
        // Additive only — the plain `outline` variant above is left untouched
        // since it's used broadly across the app.
        'outline-emboss': 'btn-emboss btn-emboss-secondary',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        ghost: 'text-accent-foreground hover:bg-accent',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-8 rounded-md px-2',
        sm: 'h-9 rounded-md px-3',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      type = asChild ? undefined : 'button',
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

const ButtonWithLoading = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { loading?: boolean; loaderClassName?: string }
>(({ loading, disabled, children, loaderClassName, ...props }, ref) => {
  return (
    <Button disabled={loading || disabled} ref={ref} {...props}>
      {loading && (
        <Loader2 className={cn('mr-2 animate-spin', loaderClassName)} />
      )}
      {children}
    </Button>
  );
});

export { Button, ButtonWithLoading, buttonVariants };
