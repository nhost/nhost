import type { BoxProps } from '@/components/ui/v2/Box';
import type { ReactElement } from 'react';
import { Box } from '@/components/ui/v2/Box';
import { Badge } from '@/components/ui/v2/Badge';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { twMerge } from 'tailwind-merge';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ExclamationIcon } from '@/components/ui/v2/icons/ExclamationIcon';

export interface ProjectHealthCardProps extends BoxProps {
  /**
   * Label of the card.
   */
  alt?: string;
  /**
   * Value of the card.
   */
  value?: string;
  /**
   * Tooltip of the card.
   */
  tooltip?: ReactElement | null;
  /**
   * Icon to display on the card.
   */
  icon: string | ReactElement;
  /**
   * Light version of the icon. This is used for the dark mode.
   */
  lightIcon?: string | ReactElement;
  /**
   * Determines whether the icon should have a background.
   * @default false
   */
  disableIconBackground?: boolean;
  /**
   * Determines whether the icon is a react component.
   * @default true
   */
  iconIsComponent?: boolean;
  /**
   * Props to be passed to the internal components.
   */
  slotProps?: {
    imgIcon?: Partial<ImageProps>;
  }

  versionMismatch?: boolean;
}

export default function ProjectHealthCard({
  alt,
  value,
  tooltip,
  icon,
  iconIsComponent = true,
  className,
  slotProps = {},
  versionMismatch = false,
  ...props
}: ProjectHealthCardProps) {
  return (
    // TODO: BUG 'arrow' prop stutters on hover 
    <Tooltip title={versionMismatch ? tooltip : ""}
      slotProps={{
        tooltip: { className: '' },
      }}
    >
      <Box
        className={twMerge(
          'min-w-12 max-w-14 grid grid-flow-row gap-0 rounded-md p-0 aspect-square',
          className,
        )}
        sx={{ backgroundColor: 'grey.200' }}
        {...props}
      >
        <div className="grid grid-flow-col items-center justify-center">
          {versionMismatch ? (
            <Badge
            variant="standard"
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            badgeContent={<ExclamationIcon className="h-3 w-3" />}
            >
              <Badge color="warning" variant="dot" >
                {iconIsComponent
                  ? icon
                  : typeof icon === 'string' && (
                    <Image
                      src={icon}
                      alt={alt}
                      width={slotProps.imgIcon?.width}
                      height={slotProps.imgIcon?.height}
                      {...slotProps.imgIcon}
                    />
                  )}
              </Badge>
            </Badge>
          ) : (<Badge color="success" variant="standard" badgeContent={<CheckIcon className="w-2 h-2 stroke-2 text-white" />}>
            {iconIsComponent
              ? icon
              : typeof icon === 'string' && (
                <Image
                  src={icon}
                  alt={alt}
                  width={slotProps.imgIcon?.width}
                  height={slotProps.imgIcon?.height}
                  {...slotProps.imgIcon}
                />
              )}
          </Badge>)}
        </div>
      </Box>
    </Tooltip>
  );
}