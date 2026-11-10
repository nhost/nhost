import { ChevronRightIcon, TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { OverviewBackupStatus } from '@/features/orgs/projects/overview/components/OverviewBackupStatus';
import { ServiceDetailsSheet } from '@/features/orgs/projects/overview/components/ServiceDetailsSheet';
import { ServiceIcon } from '@/features/orgs/projects/overview/components/ServiceIcon';
import { ServiceIssueAlert } from '@/features/orgs/projects/overview/components/ServiceIssueAlert';
import { ServiceStateIndicator } from '@/features/orgs/projects/overview/components/ServiceStateIndicator';
import {
  type OverviewService,
  useOverviewServices,
} from '@/features/orgs/projects/overview/hooks/useOverviewServices';
import { ServiceState } from '@/generated/graphql';
import { cn } from '@/lib/utils';

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ServiceRow({
  service,
  onSelect,
}: {
  service: OverviewService;
  onSelect: (service: OverviewService) => void;
}) {
  const replicas = service.status?.replicas ?? [];
  const readyReplicas = replicas.filter((replica) => replica.ready).length;
  const hasUnreadyReplicas = readyReplicas < replicas.length;
  // "1/1 ready" repeats the state dot, so the count only shows when it tells
  // something new: several copies, or some of them not ready.
  const showReplicas = replicas.length > 1 || hasUnreadyReplicas;

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(service)}
        className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex w-full items-center gap-3">
          <ServiceIcon serviceKey={service.serviceKey} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-sm">{service.name}</span>
            {(service.version || showReplicas) && (
              <span className="truncate text-muted-foreground text-xs">
                {service.version && (
                  <span className="font-mono">{service.version}</span>
                )}
                {service.isUpdateAvailable && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-1.5 inline-flex align-[-2px] text-warning">
                        <TriangleAlertIcon
                          aria-hidden
                          className="h-3.5 w-3.5"
                        />
                        <span className="sr-only">
                          Update available: {service.recommendedVersion}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Update available:{' '}
                      <span className="font-mono">
                        {service.recommendedVersion}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {service.version && showReplicas && ' · '}
                {showReplicas && (
                  <span className={cn(hasUnreadyReplicas && 'text-warning')}>
                    {readyReplicas}/{replicas.length} ready
                  </span>
                )}
              </span>
            )}
          </span>
          {/* The header already says when everything runs, so a row only
              shows its state when it's something else. */}
          {service.status?.state !== ServiceState.Running && (
            <ServiceStateIndicator
              state={service.status?.state}
              className="shrink-0 text-muted-foreground"
            />
          )}
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        </span>
        <ServiceIssueAlert service={service} />
      </button>
    </li>
  );
}

export default function OverviewServices() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { loading, services, summary, health } = useOverviewServices();
  const [selectedServiceId, setSelectedServiceId] = useState<string>();

  const selectedService = services.find(
    (service) => service.id === selectedServiceId,
  );
  const updateCount = summary.updatesAvailable.length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-lg">Health</h2>
        <Link
          href={`/orgs/${org?.slug}/projects/${project?.subdomain}/logs`}
          className="inline-flex items-center gap-1 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          Logs
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border shadow-sm">
        {loading && services.every((service) => !service.status) ? (
          <div className="flex flex-col gap-3 p-4">
            {['auth', 'postgres', 'storage', 'hasura'].map((key) => (
              <Skeleton key={key} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              {health ? (
                <ServiceStateIndicator
                  state={health.state}
                  label={health.label}
                  className="font-semibold"
                />
              ) : (
                <ServiceStateIndicator
                  label="Status unavailable"
                  className="font-semibold text-muted-foreground"
                />
              )}
              {updateCount > 0 && (
                <span className="text-warning text-xs">
                  {pluralize(updateCount, 'update', 'updates')} available
                </span>
              )}
            </div>
            <ul>
              {services.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onSelect={(selected) => setSelectedServiceId(selected.id)}
                />
              ))}
            </ul>
            <OverviewBackupStatus />
          </>
        )}
      </div>

      <ServiceDetailsSheet
        service={selectedService}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedServiceId(undefined);
          }
        }}
      />
    </section>
  );
}
