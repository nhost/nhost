import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import UpgradeToProButton from '@/features/orgs/projects/overview/components/OverviewTopBar/UpgradeToProButton';
import { ServiceStateIndicator } from '@/features/orgs/projects/overview/components/ServiceStateIndicator';
import { useOverviewServices } from '@/features/orgs/projects/overview/hooks/useOverviewServices';
import { isNotEmptyValue } from '@/lib/utils';

export default function OverviewTopBar() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { health } = useOverviewServices();

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

  return (
    <div className="flex flex-col gap-2 pb-5 md:flex-row md:items-center md:justify-between md:gap-4 md:py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-semibold text-3xl">{project.name}</h1>
        {/* Short version of the Health header, from the same summary. */}
        {health && (
          <ServiceStateIndicator
            state={health.state}
            label={health.shortLabel}
            className="h-6 rounded-full border px-2.5 font-medium text-xs"
          />
        )}
      </div>
      {/* Who made the project matters less than its name and state, so it
          sits quietly on the right of the title row. */}
      <div className="flex items-center gap-4">
        {creatorName && (
          <p className="text-muted-foreground text-sm">
            Created by{' '}
            <span className="font-medium text-foreground">{creatorName}</span>{' '}
            {createdAgo}
          </p>
        )}
        {isFreeProject && <UpgradeToProButton />}
      </div>
    </div>
  );
}
