import type { InlineCodeProps } from '@/components/presentational/InlineCode';
import { InlineCode } from '@/components/presentational/InlineCode';
import { twMerge } from 'tailwind-merge';

export default function HighlightedText({
  children,
  className,
  ...props
}: InlineCodeProps) {
  return (
    <InlineCode
      {...props}
      className={twMerge('font-display text-sm', className)}
      sx={{ color: 'text.primary', backgroundColor: 'primary.light' }}
    >
      {children}
    </InlineCode>
  );
}
