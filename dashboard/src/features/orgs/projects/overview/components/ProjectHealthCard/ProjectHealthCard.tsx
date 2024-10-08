import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Tooltip, tooltipClasses } from '@/components/ui/v2/Tooltip';
import { ProjectHealthBadge } from '@/features/projects/overview/components/ProjectHealthBadge';
import { serviceStateToBadgeColor } from '@/features/projects/overview/health';
import { ServiceState } from '@/utils/__generated__/graphql';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProjectHealthCardProps extends BoxProps {
  /**
   * Label of the card icon.
   */
  alt?: string;
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
  };
  /**
   * State of the service.
   */
  state?: ServiceState;

  /**
   * Determines whether the version is mismatched with recommended version.
   */
  isVersionMismatch?: boolean;

  /**
   * Determines whether the card is loading.
   */
  isLoading?: boolean;
}

export default function ProjectHealthCard({
  alt,
  tooltip,
  icon,
  iconIsComponent = true,
  className,
  slotProps = {},
  isVersionMismatch = false,
  isLoading = false,
  state,
  ...props
}: ProjectHealthCardProps) {
  const badgeColor = serviceStateToBadgeColor.get(state);
  const unknownState = state === undefined;
  let badgeVariant: 'dot' | 'standard' = 'dot';
  if (state === ServiceState.Running || unknownState) {
    badgeVariant = 'standard';
  }
  const showCheckIcon = state === ServiceState.Running;
  const shouldBlink = state === ServiceState.Updating;

  return (
    <Tooltip
      title={tooltip}
      slotProps={{
        popper: {
          sx: {
            [`&.${tooltipClasses.popper} .${tooltipClasses.tooltip}`]: {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.100' : 'grey.200',
              minWidth: '18rem',
            },
          },
        },
      }}
    >
      <Box
        className={twMerge(
          'grid aspect-square min-w-12 max-w-14 grid-flow-row gap-0 rounded-md p-0',
          className,
        )}
        sx={{ backgroundColor: 'grey.200' }}
        {...props}
      >
        <div className="grid grid-flow-col items-center justify-center">
          <ProjectHealthBadge
            badgeColor={!isLoading ? badgeColor : undefined}
            badgeVariant={badgeVariant}
            showCheckIcon={showCheckIcon}
            showExclamation={isVersionMismatch}
            unknownState={unknownState}
            blink={shouldBlink}
          >
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
          </ProjectHealthBadge>
        </div>
      </Box>
    </Tooltip>
  );
}
