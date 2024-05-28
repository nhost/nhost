import type { BoxProps } from '@/components/ui/v2/Box';
import type { ReactElement } from 'react';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Badge } from '@/components/ui/v2/Badge';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { twMerge } from 'tailwind-merge';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';

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
  tooltip?: string;
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
}

export default function ProjectHealthCard({
  alt,
  value,
  tooltip,
  icon,
  iconIsComponent = true,
  className,
  slotProps = {},
  ...props
}: ProjectHealthCardProps) {
  const RunList = [...Array(10).keys()].map((i) =>
  (<li className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5">
    <Box sx={{backgroundColor: "success.dark"}} className="flex-shrink-0 w-3 h-3 bg-success rounded-full" />
    {`nhost-run-x-y-${i + 1}`}
  </li>)
  );
  return (
    // TODO: 'arrow' prop bug?
    <Tooltip arrow title={<ol className="flex flex-col gap-3 px-4 py-6 m-0">{RunList}</ol>}
      slotProps={{
        tooltip: { className: '' },
      }}
    >
      <Box
        className={twMerge(
          'max-w-10 grid grid-flow-row gap-0 rounded-md p-0 aspect-square',
          className,
        )}
        sx={{ backgroundColor: 'grey.200' }}
        {...props}
      >
        <div className="grid grid-flow-col items-center justify-center">
          {/* <Box
                className={twMerge('', className,)}
                sx={{ backgroundColor: 'grey.200' }}
                {...props}
              > */}

          <Badge color="success" variant="standard" badgeContent={<CheckIcon className="w-2 h-2 stroke-2 text-white" />}>
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
          {/* </Box> */}
        </div>

        {/* {value && (
          <Text variant="h2" component="p" className="truncate">
            {value}
          </Text>
        )} */}
      </Box>
    </Tooltip>
  );
}