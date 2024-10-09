import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

export interface ContainerProps extends BoxProps {
  /**
   * Class name passed to the root element.
   */
  rootClassName?: string;
}

export default function Container({
  children,
  className,
  rootClassName,
  ...props
}: ContainerProps) {
  return (
    <Box className={twMerge('mx-auto w-full', rootClassName)} {...props}>
      <Box
        className={twMerge('mx-auto max-w-7xl px-5 py-4', className)}
        {...props}
      >
        {children}
      </Box>
    </Box>
  );
}
