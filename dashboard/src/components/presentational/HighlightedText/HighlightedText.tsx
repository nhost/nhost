import type { PropsWithChildren } from 'react';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { cn } from '@/lib/utils';

type HighlightedTextProps = PropsWithChildren<
  React.HTMLAttributes<HTMLElement>
>;

export default function HighlightedText({
  children,
  className,
  ...props
}: HighlightedTextProps) {
  return (
    <InlineCode
      {...props}
      className={cn(
        'bg-primary-light font-display text-foreground text-sm',
        className,
      )}
    >
      {children}
    </InlineCode>
  );
}
