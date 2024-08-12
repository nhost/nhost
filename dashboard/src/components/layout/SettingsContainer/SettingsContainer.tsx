import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import type { SwitchProps } from '@/components/ui/v2/Switch';
import { Switch } from '@/components/ui/v2/Switch';
import { Text } from '@/components/ui/v2/Text';
import Image from 'next/image';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface SettingsContainerProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title'
  > {
  /**
   * Icon for the section.
   */
  icon?: ReactNode | string;
  /**
   * The title for the section.
   */
  title: ReactNode | string;
  /**
   * Custom title for the documentation link.
   */
  docsTitle?: ReactNode | string;
  /**
   * The description for the section.
   */
  description?: string | ReactNode;
  /**
   * Link to the documentation.
   *
   * @default 'https://docs.nhost.io/'
   */
  docsLink?: string;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
  /**
   * If passed, the switch will be rendered as a controlled component.
   * The value of the switchId will be the name of the field in the form.
   */
  switchId?: string;
  /**
   * Function to be called when the switch is toggled.
   */
  onEnabledChange?: (enabled: boolean) => void;
  /**
   * Determines whether or not the the switch is in a toggled state and children are visible.
   */
  enabled?: boolean;
  /**
   * Determines whether or to render the switch.
   * @default false
   */
  showSwitch?: boolean;
  /**
   * Custom element to be rendered at the top-right corner of the section.
   */
  topRightElement?: ReactNode;
  /**
   * Custom class names passed to the root element.
   */
  rootClassName?: string;
  /**
   * Custom class names passed to the children wrapper element.
   */
  className?: string;
  /**
   * Props to be passed to different slots inside the component.
   */
  slotProps?: {
    /**
     * Props to be passed to the root element.
     */
    root?: BoxProps;
    /**
     * Props to be passed to the `<Switch />` component.
     */
    switch?: SwitchProps;
    /**
     * Props to be passed to the footer element.
     */
    submitButton?: ButtonProps;
    /**
     * Props to be passed to the footer element.
     */
    footer?: BoxProps;
  };
}

export default function SettingsContainer({
  children,
  docsLink,
  title,
  description,
  icon,
  submitButtonText = 'Save',
  className,
  onEnabledChange,
  enabled,
  switchId,
  showSwitch = false,
  rootClassName,
  docsTitle,
  topRightElement,
  slotProps: { root, switch: switchSlot, submitButton, footer } = {},
}: SettingsContainerProps) {
  return (
    <Box
      {...root}
      className={twMerge(
        'grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4',
        root?.className || rootClassName,
      )}
    >
      <div className="grid grid-flow-col place-content-between gap-3 px-4">
        <div className="grid grid-flow-col gap-4">
          {(typeof icon === 'string' && (
            <div className="flex items-center self-center justify-self-center align-middle">
              <Image src={icon} alt={icon} width={32} height={32} />
            </div>
          )) ||
            icon}

          <div className="grid grid-flow-row gap-1">
            {typeof title === 'string' ? (
              <Text className="text-lg font-semibold">{title}</Text>
            ) : (
              title
            )}

            {description && <Text color="secondary">{description}</Text>}
          </div>
        </div>
        {topRightElement}
        {!switchId && showSwitch && (
          <Switch
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="self-center"
            {...switchSlot}
          />
        )}
        {switchId && showSwitch && (
          <ControlledSwitch
            className="self-center"
            name={switchId}
            {...switchSlot}
          />
        )}
      </div>

      <div className={twMerge('grid grid-flow-row gap-4 px-4', className)}>
        {children}
      </div>

      <Box
        {...footer}
        className={twMerge(
          'grid grid-flow-col items-center gap-x-2 border-t px-4 pt-3.5',
          docsLink ? 'place-content-between' : 'justify-end',
          footer?.className,
        )}
      >
        {docsLink && (
          <div className="grid w-full grid-flow-col justify-start gap-x-1 self-center align-middle">
            <Text>
              Learn more about{' '}
              <Link
                href={docsLink || 'https://docs.nhost.io/'}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                className="font-medium"
              >
                {docsTitle || title}
                <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
              </Link>
            </Text>
          </div>
        )}

        <Button
          variant={submitButton?.disabled ? 'outlined' : 'contained'}
          color={submitButton?.disabled ? 'secondary' : 'primary'}
          type="submit"
          {...submitButton}
        >
          {submitButtonText}
        </Button>
      </Box>
    </Box>
  );
}
