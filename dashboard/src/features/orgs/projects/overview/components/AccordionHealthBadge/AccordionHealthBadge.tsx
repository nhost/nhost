import { ProjectHealthCheckIcon } from '@/components/ui/v3/icons/ProjectHealthCheckIcon';
import { QuestionMarkIcon } from '@/components/ui/v3/icons/QuestionMarkIcon';
import { serviceStateToIndicatorClassName } from '@/features/orgs/projects/overview/health';
import { ServiceState } from '@/generated/graphql';
import { cn } from '@/lib/utils';

interface AccordionHealthBadgeProps {
  serviceState?: ServiceState;
  unknownState?: boolean;
  /*
   * Blinking animation to indicate that the service is updating.
   */
  blink?: boolean;
}

export default function AccordionHealthBadge({
  serviceState,
  unknownState,
  blink,
}: AccordionHealthBadgeProps) {
  const indicatorClassName = serviceStateToIndicatorClassName.get(serviceState);

  if (unknownState) {
    return (
      <span
        className={cn(
          'flex h-2.5 w-2.5 items-center justify-center rounded-full',
          indicatorClassName,
        )}
      >
        <QuestionMarkIcon className="h-3/4 w-3/4 stroke-2 text-background" />
      </span>
    );
  }

  if (serviceState === ServiceState.Running) {
    return (
      <span
        className={cn(
          'flex h-2.5 w-2.5 items-center justify-center rounded-full',
          indicatorClassName,
        )}
      >
        <ProjectHealthCheckIcon className="h-3/4 w-3/4 text-background" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'h-2.5 w-2.5 rounded-full',
        indicatorClassName,
        blink && 'animate-pulse',
      )}
    />
  );
}
