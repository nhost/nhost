import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import type { TextProps } from '@/components/ui/v2/Text';
import { Text } from '@/components/ui/v2/Text';
import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface PermissionSettingsSectionProps
  extends Omit<BoxProps, 'title'> {
  /**
   * Title of the section.
   */
  title: ReactNode;
  /**
   * Props to be passed to individual slots.
   */
  slotProps?: {
    /**
     * Props to be passed to the root slot.
     */
    root?: BoxProps;
    /**
     * Props to be passed to the title slot.
     */
    title?: TextProps;
  };
}

export default function PermissionSettingsSection({
  children,
  className,
  title,
  slotProps,
  ...props
}: PermissionSettingsSectionProps) {
  return (
    <Box
      component="section"
      {...(slotProps?.root || {})}
      className={twMerge('border-y-1', slotProps?.root?.className)}
    >
      <Text
        component="h2"
        {...(slotProps?.title || {})}
        className={twMerge('px-6 py-3 font-bold', slotProps?.title?.className)}
      >
        {title}
      </Text>

      <Box
        {...props}
        className={twMerge(
          'grid grid-flow-row items-center gap-4 border-t-1 px-6 py-4',
          className,
        )}
      >
        {children}
      </Box>
    </Box>
  );
}
