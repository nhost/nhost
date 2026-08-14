import type { HTMLAttributes, ReactElement } from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/v3/hover-card';
import { ProjectHealthBadge } from '@/features/orgs/projects/overview/components/ProjectHealthBadge';
import { serviceStateToBadgeColor } from '@/features/orgs/projects/overview/health';
import { ServiceState } from '@/generated/graphql';
import { cn } from '@/lib/utils';

export interface ProjectHealthCardProps extends HTMLAttributes<HTMLElement> {
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
   * Service name used to identify the health details trigger.
   */
  serviceName?: string;

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
  serviceName,
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
  const cardClassName = cn(
    'grid aspect-square min-w-12 max-w-14 grid-flow-row gap-0 rounded-md border bg-card p-0 shadow-sm',
    tooltip &&
      'cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    className,
  );

  const cardContent = (
    <div className="grid grid-flow-col items-center justify-center">
      <ProjectHealthBadge
        badgeColor={!isLoading ? badgeColor : undefined}
        badgeVariant={badgeVariant}
        showCheckIcon={showCheckIcon}
        showExclamation={isVersionMismatch}
        unknownState={unknownState}
        blink={shouldBlink}
      >
        {typeof icon === 'string' ? null : icon}
      </ProjectHealthBadge>
    </div>
  );

  if (!tooltip) {
    return (
      <div className={cardClassName} {...props}>
        {cardContent}
      </div>
    );
  }

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cardClassName}
          aria-label={
            serviceName
              ? `${serviceName} health details`
              : 'Service health details'
          }
          {...props}
        >
          {cardContent}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-0" side="bottom" align="start">
        {tooltip}
      </HoverCardContent>
    </HoverCard>
  );
}
