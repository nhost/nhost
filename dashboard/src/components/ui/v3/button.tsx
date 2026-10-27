import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const baseButtonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // "Soft emboss" primary button: gradient fill with an inset bevel.
        default: 'btn-emboss btn-emboss-primary',
        // "Soft emboss" danger button, same recipe in the destructive reds.
        destructive: 'btn-emboss btn-emboss-danger',
        // The one outline button. Soft emboss behavior (a 1px press on click)
        // built only from tokens. Disabled fades to 50% through the base
        // classes; loading (data-loading, set by ButtonWithLoading) also
        // mutes the text and border.
        outline:
          'border border-input bg-transparent text-foreground transition-[color,background-color,border-color,transform] hover:bg-accent hover:text-accent-foreground active:translate-y-px data-[loading=true]:border-border data-[loading=true]:text-muted-foreground',
        ghost: 'text-accent-foreground hover:bg-accent',
        // Low-key button: no background, the content turns primary on hover.
        // Meant for icon-only buttons, so it defaults to the `icon-sm` size,
        // see `defaultSizeByVariant`. At rest a softened foreground: quieter
        // than text, still clearly clickable (muted-foreground reads disabled).
        subtle:
          'text-[hsl(var(--foreground)/0.58)] hover:text-primary dark:text-[hsl(var(--foreground)/0.72)] dark:hover:text-primary',
        link: 'text-primary underline-offset-4 hover:underline',
        // Rows inside a menu, like the account menu. No border or fill until
        // hover; menu-destructive is the same row in the danger color.
        menu: 'text-accent-foreground hover:bg-accent',
        'menu-destructive':
          'text-destructive hover:bg-destructive-hover hover:text-destructive',
      },
      // Icon size uses zero-specificity `:where()`, so icon classes override
      // it. Icon props like `size={16}` don't (CSS beats SVG attributes).
      size: {
        xs: 'h-8 rounded-md px-2 [:where(&_svg)]:size-4',
        sm: 'h-9 rounded-md px-3 [:where(&_svg)]:size-4',
        md: 'h-10 px-4 py-2 [:where(&_svg)]:size-4',
        lg: 'h-11 rounded-md px-8 [:where(&_svg)]:size-5',
        'icon-xs': 'h-6 w-6 [:where(&_svg)]:size-3.5',
        'icon-sm': 'h-8 w-8 [:where(&_svg)]:size-4',
        icon: 'h-10 w-10 [:where(&_svg)]:size-5',
      },
    },
    compoundVariants: [
      {
        // Full width, left aligned rows; set here so they win over the size
        // padding.
        variant: ['menu', 'menu-destructive'],
        class: 'h-9 w-full justify-start gap-2 px-2',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

type BaseButtonVariantProps = VariantProps<typeof baseButtonVariants>;
type ButtonVariant = NonNullable<BaseButtonVariantProps['variant']>;
type ButtonSize = NonNullable<BaseButtonVariantProps['size']>;

// Variants whose default size differs from the global `sm`, so callers don't
// have to remember to pass a size. An explicit `size` still wins.
const defaultSizeByVariant: Partial<Record<ButtonVariant, ButtonSize>> = {
  subtle: 'icon-sm',
};

function buttonVariants(props?: Parameters<typeof baseButtonVariants>[0]) {
  const size =
    props?.size ??
    (props?.variant ? defaultSizeByVariant[props.variant] : undefined);

  return baseButtonVariants({ ...props, size });
}

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
    <Button
      disabled={loading || disabled}
      data-loading={loading ? 'true' : undefined}
      ref={ref}
      {...props}
    >
      {loading && (
        <Loader2 className={cn('mr-2 animate-spin', loaderClassName)} />
      )}
      {children}
    </Button>
  );
});

export { Button, ButtonWithLoading, buttonVariants };
