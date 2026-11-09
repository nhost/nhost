import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ChevronRightIcon, HistoryIcon } from 'lucide-react';
import Link from 'next/link';
import { useIsPiTREnabled } from '@/features/orgs/hooks/useIsPiTREnabled';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetApplicationBackupsQuery } from '@/generated/graphql';

/**
 * One line at the bottom of Services with the latest database backup, so
 * people can see at a glance that their data is safe.
 */
export default function OverviewBackupStatus() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const isFreePlan = !!org?.plan.isFree;
  const { isPiTREnabled, loading: pitrLoading } = useIsPiTREnabled();

  const { data, loading } = useGetApplicationBackupsQuery({
    variables: { appId: project?.id },
    skip: !project?.id || isFreePlan,
  });

  if (!org || !project || pitrLoading || loading) {
    return null;
  }

  const latest = data?.app?.backups.find((backup) => backup.completedAt);
  let text: string;

  if (isFreePlan) {
    text = "Backups aren't included on the Free plan";
  } else if (isPiTREnabled) {
    text = 'Point in time recovery is on';
  } else if (latest?.completedAt) {
    text = `Last backup ${formatDistanceToNowStrict(parseISO(latest.completedAt), { addSuffix: true })}`;
  } else {
    text = 'No backups yet';
  }

  return (
    <div className="flex items-center gap-2.5 border-t px-4 py-3 text-muted-foreground text-sm">
      <HistoryIcon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
      {!isFreePlan && (
        <Link
          href={`/orgs/${org.slug}/projects/${project.subdomain}/database/backups`}
          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        >
          Backups
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
