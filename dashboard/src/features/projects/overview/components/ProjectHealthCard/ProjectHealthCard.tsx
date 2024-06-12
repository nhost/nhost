import type { BoxProps } from '@/components/ui/v2/Box';
import type { ReactElement } from 'react';
import { Box } from '@/components/ui/v2/Box';
import { Badge, type BadgeProps } from '@/components/ui/v2/Badge';
import { Tooltip, tooltipClasses } from '@/components/ui/v2/Tooltip';
import { twMerge } from 'tailwind-merge';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ExclamationFilledIcon } from '@/components/ui/v2/icons/ExclamationFilledIcon';

interface HealthBadgeProps extends BadgeProps {
  status?: "success" | "warning" | "error";
  showExclamation?: boolean;
}

function HealthBadge({ status, showExclamation, children, ...props }: HealthBadgeProps) {
  if (!status) {
    return <div>{children}</div>
  }
  if (showExclamation) {
    return (
      <Badge
        variant="standard"
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        badgeContent={<ExclamationFilledIcon sx={{
          color: (theme) => theme.palette.mode === "dark" ? "grey.900" : "grey.600",
        }} className="h-3 w-3" />}
      >
        <Badge
          color={status}
          variant={status === "success" ? "standard" : "dot"}
          badgeContent={status === "success"
            ? <CheckIcon 
              sx={{
                color: (theme) => theme.palette.mode === "dark" ? "grey.200" : "grey.100",
              }}
            className="w-2 h-2 stroke-2" />
            : null}
          sx={{
            color: (theme) => theme.palette.mode === "dark" ? "grey.900" : "text.primary",
          }}
          {...props}
        >
          {children}
        </Badge>
      </Badge>
    )
  }

  return (
    <Badge
      color={status}
      variant={status === "success" ? "standard" : "dot"}
      badgeContent={status === "success"
        ? <CheckIcon 
        sx={{
          color: (theme) => theme.palette.mode === "dark" ? "grey.200" : "grey.100",
        }}
        className="w-2 h-2 stroke-2" />
        : null}
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
  }

  status?: "success" | "warning" | "error";

  versionMismatch?: boolean;
}

export default function ProjectHealthCard({
  alt,
  tooltip,
  icon,
  iconIsComponent = true,
  className,
  slotProps = {},
  versionMismatch = false,
  status,
  ...props
}: ProjectHealthCardProps) {
  return (
    // TODO: BUG 'arrow' prop stutters on hover 
    <Tooltip title={tooltip} 
    slotProps={{
      popper: {
        sx: {
          [`&.${tooltipClasses.popper} .${tooltipClasses.tooltip}`]:
          {
            backgroundColor: (theme) => theme.palette.mode === "dark" ? "background.tooltip" : "grey.200",
          },
        }
      }
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
          <HealthBadge
            status={status}
            showExclamation={versionMismatch}
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