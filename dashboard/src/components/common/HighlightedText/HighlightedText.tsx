import InlineCode from '@/components/common/InlineCode';
import type { PropsWithChildren } from 'react';

export default function HighlightedText({
  children,
}: PropsWithChildren<unknown>) {
  return (
    <InlineCode className="text-greyscaleDark bg-primary-light font-display text-sm">
      {children}
    </InlineCode>
  );
}
