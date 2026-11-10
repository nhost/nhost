import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetUnifiedDeploymentsSubSubscription,
  useLatestLiveUnifiedDeploymentSubSubscription,
} from '@/generated/graphql';

const FAILED_STATUSES = ['failed', 'FAILED'];

/**
 * Big alert under the project title when the latest deployment failed, so it
 * can't be missed. Renders nothing otherwise.
 */
export default function OverviewFailedDeploymentAlert() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const skip = !project?.id || !project.githubRepository;

  const { data } = useGetUnifiedDeploymentsSubSubscription({
    variables: { appId: project?.id, limit: 1, offset: 0 },
    skip,
  });
  const { data: liveData } = useLatestLiveUnifiedDeploymentSubSubscription({
    variables: { appId: project?.id },
    skip,
  });

  const latest = data?.unifiedDeployments[0];

  if (!latest?.status || !FAILED_STATUSES.includes(latest.status)) {
    return null;
  }

  const hasLiveDeployment = !!liveData?.unifiedDeployments[0];
  const date = latest.startedAt ?? latest.createdAt;

  return (
    <Alert
      variant="destructive"
      iconPosition="top"
      className="mb-5 flex flex-col gap-3 bg-destructive/10 text-foreground sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <AlertTitle className="mb-0">Latest deployment failed</AlertTitle>
        <AlertDescription className="flex flex-col gap-0.5">
          <span className="truncate">
            {latest.commitMessage?.trim() || 'No commit message'}
            {latest.commitSHA && (
              <>
                {' · '}
                <span className="font-mono text-xs">
                  {latest.commitSHA.slice(0, 7)}
                </span>
              </>
            )}
            {date &&
              ` · ${formatDistanceToNowStrict(parseISO(date), { addSuffix: true })}`}
          </span>
          {hasLiveDeployment && (
            <span className="text-muted-foreground text-xs">
              Your live version is still the previous deployment.
            </span>
          )}
        </AlertDescription>
      </div>
      <Link
        href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/${latest.id}`}
        className="inline-flex shrink-0 items-center gap-1 font-medium text-sm underline underline-offset-2"
      >
        View deployment
        <ChevronRightIcon className="h-4 w-4" />
      </Link>
    </Alert>
  );
}
