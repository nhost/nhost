import { Badge, type BadgeProps } from '@/components/ui/v2/Badge';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ExclamationFilledIcon } from '@/components/ui/v2/icons/ExclamationFilledIcon';
import { Tooltip, tooltipClasses } from '@/components/ui/v2/Tooltip';
import { serviceStateToBadgeColor } from '@/features/projects/overview/health';
import { ServiceState } from '@/utils/__generated__/graphql';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';

interface HealthBadgeProps extends BadgeProps {
  badgeVariant?: 'standard' | 'dot';
  badgeColor?: 'success' | 'error' | 'warning' | 'secondary';
  showExclamation?: boolean;
  showCheckIcon?: boolean;
  isLoading?: boolean;
  blink?: boolean;
}

function HealthBadge({
  badgeColor,
  badgeVariant,
  showExclamation,
  showCheckIcon,
  blink,
  children,
  ...props
}: HealthBadgeProps) {
  if (!badgeColor) {
    return <div>{children}</div>;
  }

  if (showExclamation) {
    return (
      <Badge
        variant="standard"
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        badgeContent={
          <ExclamationFilledIcon
            sx={{
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.900' : 'grey.600',
            }}
            className="h-2.5 w-2.5"
          />
        }
      >
        <Badge
          color={badgeColor}
          variant={badgeVariant}
          badgeContent={
            showCheckIcon ? (
              <CheckIcon
                sx={{
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
                }}
                className="h-2 w-2 stroke-2"
              />
            ) : null
          }
          sx={{
            color: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.900' : 'text.primary',
          }}
          componentsProps={{
            badge: {
              className: blink ? 'animate-pulse' : '',
            },
          }}
          {...props}
        >
          {children}
        </Badge>
      </Badge>
    );
  }

  return (
    <Badge
      color={badgeColor}
      variant={badgeVariant}
      badgeContent={
        showCheckIcon ? (
          <CheckIcon
            sx={{
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
            }}
            className="h-2 w-2 stroke-2"
          />
        ) : null
      }
      componentsProps={{
        badge: {
          className: blink ? 'animate-pulse' : '',
        },
      }}
      {...props}
    >
      {children}
    </Badge>
  );
}

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
  const badgeVariant = state === ServiceState.Running ? 'standard' : 'dot';
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
          <HealthBadge
            badgeColor={!isLoading ? badgeColor : undefined}
            badgeVariant={badgeVariant}
            showCheckIcon={showCheckIcon}
            showExclamation={isVersionMismatch}
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
          </HealthBadge>
        </div>
      </Box>
    </Tooltip>
  );
}
