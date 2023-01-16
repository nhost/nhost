import InlineCode from '@/components/common/InlineCode';
import type { PropsWithChildren } from 'react';

export default function HighlightedText({
  children,
}: PropsWithChildren<unknown>) {
  return (
    <InlineCode
      className="font-display text-sm"
      sx={{ color: 'text.primary', backgroundColor: 'primary.light' }}
    >
      {children}
    </InlineCode>
  );
}
