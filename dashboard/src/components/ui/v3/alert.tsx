import { cva, type VariantProps } from 'class-variance-authority';
import {
  CircleCheck,
  Info,
  type LucideIcon,
  OctagonAlert,
  TriangleAlert,
} from 'lucide-react';
import type * as React from 'react';

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

const Alert = ({
  className,
  variant,
  iconPosition = 'center',
  children,
  ref,
  ...props
}: AlertProps & { ref?: React.Ref<HTMLDivElement> }) => {
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
};

const AlertTitle = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  ref?: React.Ref<HTMLParagraphElement>;
}) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  >
    {props.children}
  </h5>
);

const AlertDescription = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & {
  ref?: React.Ref<HTMLParagraphElement>;
}) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
);

export { Alert, AlertDescription, AlertTitle };
