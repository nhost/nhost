import { Button } from '@/components/ui/v3/button';
import {
  type baseServices,
  type ServiceHealthInfo,
  serviceStateToIndicatorClassName,
} from '@/features/orgs/projects/overview/health';
import { ServiceState } from '@/generated/graphql';
import { cn } from '@/lib/utils';

export interface RunStatusTooltipProps {
  servicesStatusInfo: Array<ServiceHealthInfo>;
  openHealthModal: (
    defaultExpanded?: keyof typeof baseServices | 'run',
  ) => void;
}

export default function RunStatusTooltip({
  servicesStatusInfo,
  openHealthModal,
}: RunStatusTooltipProps) {
  return (
    <div className="flex w-full flex-col gap-3 px-2 py-3">
      <ol className="m-0 flex flex-col gap-3">
        {servicesStatusInfo.map((service) => (
          <li
            key={service.name}
            className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5"
          >
            <span
              className={cn(
                'h-3 w-3 flex-shrink-0 rounded-full',
                serviceStateToIndicatorClassName.get(service.state),
                service.state === ServiceState.Updating && 'animate-pulse',
              )}
            />
            <span className="font-semibold text-foreground">
              {service.name}
            </span>
          </li>
        ))}
      </ol>
      <Button variant="outline" onClick={() => openHealthModal('run')}>
        View state
      </Button>
    </div>
  );
}
