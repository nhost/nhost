import type { TextProps } from '@/ui/Text';
import { Text } from '@/ui/Text';
import type { PropsWithChildren, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface SettingsSectionProps {
  /**
   * Title of this section.
   */
  title: ReactNode;
  /**
   * Props to be passed to the title component.
   */
  titleProps?: TextProps;
  /**
   * Props to be passed to the wrapper component.
   */
  wrapperProps?: TextProps;
  /**
   * Description of this section.
   */
  desc?: ReactNode;
  /**
   * Props to be passed to the description component.
   */
  descriptionProps?: TextProps;
}

export function SettingsSection({
  children,
  title,
  titleProps,
  descriptionProps,
  desc,
  wrapperProps,
}: PropsWithChildren<SettingsSectionProps>) {
  const { className: titleClassName, ...restTitleProps } = titleProps || {};
  const { className: wrapperClassName } = wrapperProps || {};
  const { className: descriptionClassName, ...restDescriptionProps } =
    descriptionProps || {};

  return (
    <div className={twMerge('mt-10', wrapperClassName)}>
      <div className="mx-auto font-display">
        <div className="flex flex-col place-content-between">
          <div>
            <Text
              size="large"
              variant="heading"
              className={twMerge('mb-1.5 font-medium', titleClassName)}
              color="greyscaleDark"
              {...restTitleProps}
            >
              {title}
            </Text>
            {desc && (
              <Text
                variant="body"
                size="normal"
                color="greyscaleDark"
                className={twMerge('mb-3 font-normal', descriptionClassName)}
                {...restDescriptionProps}
              >
                {desc}
              </Text>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
