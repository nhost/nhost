import { cn } from '@/lib/utils';
import type { PropsWithChildren } from 'react';

export function InlineCode({
  children,
  className,
  ...props
}: PropsWithChildren<{ className?: string }>) {
  return (
    <code
      className={cn(
        'relative rounded bg-[#eaedf0] px-1 font-mono text-[11px] dark:bg-[#2f363d]',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
