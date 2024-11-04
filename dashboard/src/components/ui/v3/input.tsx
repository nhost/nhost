import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, prefix, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent',
            prefix && 'pl-6',
            className,
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
