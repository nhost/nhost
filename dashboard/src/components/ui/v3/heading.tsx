import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

// Define heading variants using cva (class-variance-authority)
const headingVariants = cva(
  'text-foreground', // base classes
  {
    variants: {
      variant: {
        h1: 'scroll-m-20 text-4xl font-medium tracking-tight lg:text-5xl',
        h2: 'scroll-m-20 pb-2 text-3xl font-medium tracking-tight transition-colors first:mt-0',
        h3: 'scroll-m-20 text-2xl font-medium tracking-tight',
        h4: 'scroll-m-20 text-xl font-medium tracking-tight',
      },
    },
    defaultVariants: {
      variant: 'h1',
    },
  },
);

// Map variants to HTML elements
const variantElementMap = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
} as const;

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  children: React.ReactNode;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, variant = 'h1', children, ...props }, ref) => {
    const Element = variantElementMap[variant || 'h1'];

    return React.createElement(
      Element,
      {
        className: cn(headingVariants({ variant }), className),
        ref,
        ...props,
      },
      children,
    );
  },
);

Heading.displayName = 'Heading';

export { Heading, headingVariants };
