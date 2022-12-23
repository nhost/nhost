import type { TextProps } from '@/ui/v2/Text';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface PermissionSettingsSectionProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title'
  > {
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
    root?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>;
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
    <section
      {...(slotProps?.root || {})}
      className={twMerge(
        'bg-white border-y-1 border-gray-200',
        slotProps?.root?.className,
      )}
    >
      <Text
        component="h2"
        {...(slotProps?.title || {})}
        className={twMerge(
          'px-6 py-3 font-bold border-b-1 border-gray-200',
          slotProps?.title?.className,
        )}
      >
        {title}
      </Text>

      <div
        {...props}
        className={twMerge(
          'grid grid-flow-row gap-4 items-center px-6 py-4',
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
