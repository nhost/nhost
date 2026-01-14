import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type React from 'react';

const spinnerVariants = cva('flex-col items-center justify-center', {
  variants: {
    show: {
      true: 'flex',
      false: 'hidden',
    },
  },
  defaultVariants: {
    show: true,
  },
});

const loaderVariants = cva('animate-spin text-primary', {
  variants: {
    size: {
      small: 'size-6',
      medium: 'size-8',
      large: 'size-12',
    },
  },
  defaultVariants: {
    size: 'medium',
  },
});

interface SpinnerContentProps
  extends VariantProps<typeof spinnerVariants>,
    VariantProps<typeof loaderVariants> {
  className?: string;
  children?: React.ReactNode;
  wrapperClassName?: string;
}

export function Spinner({
  size,
  show,
  children,
  className,
  wrapperClassName,
}: SpinnerContentProps) {
  return (
    <span className={cn(spinnerVariants({ show }), wrapperClassName)}>
      <Loader2
        role="progressbar"
        className={cn(
          loaderVariants({ size }),
          className,
          'stroke-[#1e324b] dark:stroke-[#dfecf5]',
        )}
      />
      {children}
    </span>
  );
}
