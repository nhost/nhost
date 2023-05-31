import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

export interface InlineCodeProps extends BoxProps {}

function InlineCode({ className, children, ...props }: InlineCodeProps) {
  return (
    <Box
      component="code"
      className={twMerge(
        'inline-grid max-w-xs items-center truncate rounded-sm px-1 font-mono text-[11px]',
        className,
      )}
      sx={{ backgroundColor: 'grey.300', color: 'text.primary' }}
      {...props}
    >
      {children}
    </Box>
  );
}

export default InlineCode;
