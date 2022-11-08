import type { CardElement } from '@/components/overview/frameworks';
import ArrowRightIcon from '@/ui/v2/icons/ArrowRightIcon';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

export interface OverviewCardProps extends CardElement {
  /**
   * Props to be passed to the internal components.
   */
  componentsProps?: {
    iconWrapper?: DetailedHTMLProps<
      HTMLAttributes<HTMLDivElement>,
      HTMLDivElement
    >;
    imgIcon?: Partial<ImageProps>;
  };
}

export default function OverviewCard({
  title,
  description,
  icon,
  link,
  iconIsComponent = true,
  className,
  componentsProps = {
    iconWrapper: {
      className: '',
    },
  },
  ...props
}: OverviewCardProps) {
  return (
    <div
      className={twMerge(
        'flex h-full flex-col place-content-between gap-12 rounded-lg bg-card py-3 px-4 shadow-sm',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-4">
        <div
          {...componentsProps.iconWrapper}
          className={twMerge(
            'inline-flex h-12 w-12 items-center',
            componentsProps.iconWrapper?.className,
          )}
        >
          {iconIsComponent
            ? icon
            : typeof icon === 'string' && (
                <Image
                  src={icon}
                  alt={title}
                  width={componentsProps.imgIcon?.width}
                  height={componentsProps.imgIcon?.height}
                  {...componentsProps.imgIcon}
                />
              )}
        </div>
        <div className="grid grid-flow-row gap-1">
          <Text variant="h3" className="!font-bold">
            {title}
          </Text>
          <Text className="!font-medium">{description}</Text>
        </div>
      </div>
      <Link
        variant="body2"
        underline="hover"
        href={link}
        target="_blank"
        rel="dofollow"
        className="font-medium"
      >
        Learn more
        <ArrowRightIcon className="ml-1.5 inline-flex h-4 w-4 cursor-pointer text-blue" />
      </Link>
    </div>
  );
}
