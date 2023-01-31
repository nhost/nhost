import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
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
    <Box className={twMerge('mx-auto w-full', rootClassName)}>
      <Box
        className={twMerge('mx-auto max-w-7xl px-5 pt-6 pb-20', className)}
        {...props}
      >
        {children}
      </Box>
    </Box>
  );
}
