import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

export interface FormActivityIndicatorProps extends BoxProps {}

export default function FormActivityIndicator({
  className,
  ...props
}: FormActivityIndicatorProps) {
  return (
    <Box
      {...props}
      className={twMerge(
        'grid items-center justify-center px-6 py-4',
        className,
      )}
    >
      <ActivityIndicator
        circularProgressProps={{ className: 'w-5 h-5' }}
        label="Loading form..."
      />
    </Box>
  );
}
