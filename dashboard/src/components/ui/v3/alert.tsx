import { cva, type VariantProps } from 'class-variance-authority';
import {
  CircleCheck,
  Info,
  type LucideIcon,
  OctagonAlert,
  TriangleAlert,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border p-4', {
  variants: {
    variant: {
      default: 'bg-background text-foreground',
      destructive:
        'border-destructive/50 text-destructive dark:border-destructive',
      warning: 'border-warning/30 bg-warning/10 text-foreground',
      success: 'border-emerald-500/30 bg-emerald-500/10 text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;

// Every variant always shows its own icon. It sits in the left padding
// (absolute), so the layout classes a page passes to Alert keep working.
const alertIcons: Record<AlertVariant, { icon: LucideIcon; color: string }> = {
  default: { icon: Info, color: 'text-foreground' },
  destructive: { icon: OctagonAlert, color: 'text-destructive' },
  warning: { icon: TriangleAlert, color: 'text-warning' },
  success: { icon: CircleCheck, color: 'text-emerald-500' },
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /**
   * Where the icon sits. "center" (default) suits one or two lines; "top"
   * pins it next to the first line, for alerts with more content below
   * (e.g. a list of values), where a centered icon floats in the middle.
   */
  iconPosition?: 'center' | 'top';
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant, iconPosition = 'center', children, ...props },
    ref,
  ) => {
    const { icon: Icon, color } = alertIcons[variant ?? 'default'];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className, 'pl-12')}
        {...props}
      >
        {children}
        <Icon
          aria-hidden="true"
          className={cn(
            'absolute left-4 h-5 w-5 shrink-0',
            iconPosition === 'top' ? 'top-4' : 'top-1/2 -translate-y-1/2',
            color,
          )}
        />
      </div>
    );
  },
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  >
    {props.children}
  </h5>
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription, AlertTitle };
