import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import type { baseServices } from '@/features/orgs/projects/overview/health';
import { ServiceState } from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';

interface ServiceVersionTooltipProps {
  serviceName?: string;
  serviceKey?: keyof typeof baseServices;
  usedVersion?: string;
  recommendedVersionMismatch?: boolean;
  recommendedVersions?: string[];
  children?: ReactNode;
  openHealthModal: (
    defaultExpanded?: keyof typeof baseServices | 'run',
  ) => void;
  state?: ServiceState;
}

function ServiceVersionTooltip({
  serviceName,
  usedVersion,
  recommendedVersionMismatch,
  recommendedVersions,
  children,
  openHealthModal,
  state,
  serviceKey,
}: ServiceVersionTooltipProps) {
  let errorMessage = '';
  if (state === ServiceState.UpdateError) {
    errorMessage =
      'degraded or failed to update, click on view state for further details';
  } else if (state === ServiceState.Error || state === ServiceState.None) {
    errorMessage =
      'is offline due to errors, click on view state for further details';
  }

  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      <div className="flex flex-row justify-between gap-6">
        <p className="text-muted-foreground text-sm+">service</p>
        <p className="font-semibold text-foreground text-sm+">{serviceName}</p>
      </div>
      <div className="flex flex-row justify-between gap-6">
        <p className="text-muted-foreground text-sm+">version</p>
        <p className="font-bold text-foreground text-sm+">{usedVersion}</p>
      </div>
      {recommendedVersionMismatch && (
        <div className="rounded-md bg-muted p-2">
          <p className="text-foreground text-sm+">
            {serviceName} is not using a recommended version. Recommended
            version(s):
          </p>
          {isNotEmptyValue(recommendedVersions) ? (
            <ul className="list-disc text-sm+">
              {recommendedVersions.map((version) => (
                <li className="ml-6 list-item" key={version}>
                  <p className="text-foreground">{version}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {errorMessage ? (
        <div className="rounded-md bg-destructive p-2">
          <p className="font-semibold text-destructive-foreground text-sm+">
            {serviceName} {errorMessage}
          </p>
        </div>
      ) : null}
      <Button variant="outline" onClick={() => openHealthModal(serviceKey)}>
        View state
      </Button>
      {children}
    </div>
  );
}

export default ServiceVersionTooltip;
