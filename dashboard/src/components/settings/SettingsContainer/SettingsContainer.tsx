import ExternalLink from '@/components/icons/ExternalIcon';
import type { ButtonProps } from '@/ui/v2/Button';
import Button from '@/ui/v2/Button';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
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
   * The description for the section.
   */
  description: string | ReactNode;
  /**
   * Link to the documentation.
   *
   * @default 'https://docs.nhost.io/'
   */
  docsLink?: string;
  /**
   * Props for the primary action.
   */
  primaryActionButtonProps?: ButtonProps;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
  /**
   * Pass a form ID to the submit button.
   */
  formId?: string;
}

export default function SettingsContainer({
  children,
  docsLink,
  title,
  description,
  icon,
  primaryActionButtonProps,
  formId,
  submitButtonText = 'Save',
  className,
}: SettingsContainerProps) {
  return (
    <div
      className={twMerge(
        'grid grid-flow-row gap-4 rounded-lg border-1 border-gray-200 bg-white py-4',
        className,
      )}
    >
      <div className="grid grid-flow-col items-center justify-start gap-3 px-4">
        {(typeof icon === 'string' && (
          <div className="flex items-center self-center justify-self-center align-middle">
            <Image src={icon} alt={`icon of ${title}`} width={32} height={32} />
          </div>
        )) ||
          icon}

        <div className="grid grid-flow-row gap-1">
          <Text className="text-lg font-semibold">{title}</Text>

          {description && (
            <Text className="text-greyscaleMedium">{description}</Text>
          )}
        </div>
      </div>

      {children}

      <div
        className={twMerge(
          'grid grid-flow-col items-center border-t border-gray-200 px-4 pt-3.5',
          docsLink ? 'place-content-between' : 'justify-end',
        )}
      >
        {docsLink && (
          <div className="grid w-full grid-flow-col justify-start gap-x-1 self-center align-middle">
            <Text className="text-greyscaleDark">Learn more about</Text>
            <Link
              href={docsLink || 'https://docs.nhost.io/'}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              className="grid grid-flow-col items-center justify-center gap-x-1 font-medium"
            >
              {title}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        )}

        <Button
          variant="outlined"
          color="secondary"
          {...primaryActionButtonProps}
          form={formId}
          type={formId ? 'submit' : 'button'}
        >
          {submitButtonText}
        </Button>
      </div>
    </div>
  );
}
