import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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

const loaderVariants = cva('animate-spin', {
  variants: {
    size: {
      xs: 'size-3',
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
  children?: ReactNode;
  wrapperClassName?: string;
  delay?: number;
}

export function Spinner({
  size,
  show = true,
  children,
  className,
  wrapperClassName,
  delay = 0,
}: SpinnerContentProps) {
  const [isDelayed, setIsDelayed] = useState(delay > 0);

  useEffect(() => {
    if (delay <= 0) {
      setIsDelayed(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsDelayed(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const shouldShow = show && !isDelayed;

  return (
    <span
      className={cn(spinnerVariants({ show: shouldShow }), wrapperClassName)}
    >
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
