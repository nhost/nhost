import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Tooltip, tooltipClasses } from '@/components/ui/v2/Tooltip';
import { ProjectHealthBadge } from '@/features/orgs/projects/overview/components/ProjectHealthBadge';
import { serviceStateToBadgeColor } from '@/features/orgs/projects/overview/health';
import { isNotEmptyValue } from '@/lib/utils';
import { ServiceState } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProjectHealthCardProps extends BoxProps {
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
  tooltip,
  icon,
  className,
  isVersionMismatch = false,
  isLoading = false,
  state,
  ...props
}: ProjectHealthCardProps) {
  const badgeColor = isNotEmptyValue(state)
    ? serviceStateToBadgeColor.get(state)
    : state;
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
            {icon}
          </ProjectHealthBadge>
        </div>
      </Box>
    </Tooltip>
  );
}
