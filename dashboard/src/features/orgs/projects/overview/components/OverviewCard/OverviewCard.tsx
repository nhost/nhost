import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import { twMerge } from 'tailwind-merge';

export interface OverviewCardProps extends CardProps {
  /**
   * Props to be passed to the internal components.
   */
  slotProps?: {
    iconWrapper?: BoxProps;
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
  slotProps = {},
  ...props
}: OverviewCardProps) {
  return (
    <Box
      className={twMerge(
        'flex h-full flex-col place-content-between gap-12 rounded-lg px-4 py-3 shadow-sm',
        className,
      )}
      sx={{ backgroundColor: 'grey.200' }}
      {...props}
    >
      <div className="flex flex-col gap-4">
        <Box
          {...(slotProps.iconWrapper || {})}
          className={twMerge(
            'inline-flex h-12 w-12 items-center',
            slotProps.iconWrapper?.className,
          )}
        >
          {iconIsComponent
            ? icon
            : typeof icon === 'string' && (
                <Image
                  src={icon}
                  alt={title}
                  width={slotProps.imgIcon?.width}
                  height={slotProps.imgIcon?.height}
                  {...slotProps.imgIcon}
                />
              )}
        </Box>
        <div className="grid grid-flow-row gap-1">
          <Text variant="h3" className="!font-bold">
            {title}
          </Text>
          <Text className="!font-medium" color="secondary">
            {description}
          </Text>
        </div>
      </div>
      <Link
        variant="body2"
        underline="hover"
        href={link}
        target="_blank"
        rel="dofollow"
        className="grid grid-flow-col items-center justify-start gap-1 font-medium"
      >
        Learn more
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </Box>
  );
}
