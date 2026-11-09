import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import UpgradeToProButton from '@/features/orgs/projects/overview/components/OverviewTopBar/UpgradeToProButton';
import { ServiceStateIndicator } from '@/features/orgs/projects/overview/components/ServiceStateIndicator';
import { useOverviewServices } from '@/features/orgs/projects/overview/hooks/useOverviewServices';
import { ServiceState } from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';

export default function OverviewTopBar() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { services, summary } = useOverviewServices();

  const isFreeProject = !!org?.plan.isFree;

  if (!isPlatform) {
    return (
      <div className="flex flex-row place-content-between items-center py-5">
        <div className="flex flex-row items-center space-x-2">
          <h1 className="font-semibold text-3xl">local</h1>
        </div>
      </div>
    );
  }

  if (!isNotEmptyValue(project)) {
    return null;
  }

  const creatorName = project.creator?.displayName || project.creator?.email;
  const createdAgo = `${formatDistanceToNowStrict(parseISO(project.createdAt))} ago`;

  const hasStatus = services.some((service) => service.status);
  let projectStatus: { label: string; state: ServiceState } | null = null;

  if (hasStatus) {
    if (summary.down.length > 0) {
      projectStatus = { label: 'Degraded', state: ServiceState.Error };
    } else if (summary.updating.length > 0) {
      projectStatus = { label: 'Updating', state: ServiceState.Updating };
    } else {
      projectStatus = { label: 'Healthy', state: ServiceState.Running };
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-5 md:flex-row md:items-start md:justify-between md:py-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-semibold text-3xl">{project.name}</h1>
          {projectStatus && (
            <ServiceStateIndicator
              state={projectStatus.state}
              label={projectStatus.label}
              className="h-6 rounded-full border px-2.5 font-medium text-xs"
            />
          )}
        </div>
        {creatorName && (
          <p className="text-muted-foreground text-sm">
            Created by{' '}
            <span className="font-medium text-foreground">{creatorName}</span>{' '}
            {createdAgo}
          </p>
        )}
      </div>
      {isFreeProject && (
        <div className="flex gap-4">
          <UpgradeToProButton />
        </div>
      )}
    </div>
  );
}
