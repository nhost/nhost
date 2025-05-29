import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

export const containerVariants = cva('mx-auto px-4 sm:px-6 lg:px-8', {
  variants: {
    variant: {
      fullMobileConstrainedPadded: 'max-w-7xl sm:px-6 lg:px-8',
      constrainedPadded: 'max-w-7xl px-4 sm:px-6 lg:px-8',
      fullMobileBreakpointPadded: 'container mx-auto sm:px-6 lg:px-8',
      breakpointPadded: 'container mx-auto px-4 sm:px-6 lg:px-8',
      narrowConstrainedPadded: 'max-w-7xl px-4 sm:px-6 lg:px-8 max-w-3xl',
    },
  },
  defaultVariants: {
    variant: 'narrowConstrainedPadded',
  },
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  asChild?: boolean;
}

function Container({
  asChild,
  className,
  children,
  variant,
  ...props
}: ContainerProps) {
  const Comp = asChild ? React.Fragment : 'div';
  const containerClasses = cn(containerVariants({ variant }), className);

  return (
    <Comp className={containerClasses} {...props}>
      {variant === 'narrowConstrainedPadded' ? (
        <div className="mx-auto max-w-3xl">{children}</div>
      ) : (
        children
      )}
    </Comp>
  );
}

export default Container;
