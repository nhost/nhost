import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

export function InlineCode({
  children,
  className,
  ...props
}: PropsWithChildren<React.HTMLAttributes<HTMLElement>>) {
  return (
    <code
      className={cn(
        'relative max-w-xs truncate rounded bg-neutral-200 px-1 font-mono text-[11px] dark:bg-muted',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
