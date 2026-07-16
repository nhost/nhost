import { twMerge } from 'tailwind-merge';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Spinner } from '@/components/ui/v3/spinner';

export interface LoadingScreenProps extends BoxProps {
  /**
   * Props passed to individual component slots.
   */
  slotProps?: {
    /**
     * Props passed to the `<Box />` component.
     */
    root?: BoxProps;
  };
}

export default function LoadingScreen({
  className,
  slotProps = { root: {} },
  ...props
}: LoadingScreenProps) {
  return (
    <Box
      className={twMerge(
        'absolute top-0 right-0 bottom-0 left-0 z-50 flex h-full w-full items-center justify-center',
        className,
        slotProps?.root?.className,
      )}
      {...slotProps?.root}
      {...props}
    >
      <Spinner className="h-5 w-5" />
    </Box>
  );
}
