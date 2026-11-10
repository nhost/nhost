import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { ChevronRightIcon, RocketIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { DeploymentListItem } from '@/features/orgs/projects/deployments/components/DeploymentListItem';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetUnifiedDeploymentsSubSubscription,
  useLatestLiveUnifiedDeploymentSubSubscription,
  usePendingOrRunningUnifiedDeploymentsSubSubscription,
} from '@/generated/graphql';

function OverviewDeploymentsTopBar() {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  const isGitHubConnected = !!project?.githubRepository;

  return (
    <div className="grid grid-flow-col place-content-between items-center gap-2 pb-4">
      <h2 className="font-semibold text-lg">Deployments</h2>

      {isGitHubConnected && (
        <Link
          href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments`}
          className="inline-flex items-center gap-1 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          View all
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function OverviewDeploymentList() {
  const { project } = useProject();

  const { data, loading } = useGetUnifiedDeploymentsSubSubscription({
    variables: {
      appId: project?.id,
      limit: 5,
      offset: 0,
    },
  });

  const { data: latestLiveData, loading: latestLiveLoading } =
    useLatestLiveUnifiedDeploymentSubSubscription({
      variables: { appId: project?.id },
    });

  const { data: pendingOrRunningData, loading: pendingOrRunningLoading } =
    usePendingOrRunningUnifiedDeploymentsSubSubscription({
      variables: { appId: project?.id },
    });

  if (loading || latestLiveLoading || pendingOrRunningLoading) {
    return (
      <div className="h-80 rounded-lg border p-2">
        <Spinner size="xs" wrapperClassName="flex-row gap-1.5">
          <span className="text-muted-foreground text-xs">
            Loading deployments...
          </span>
        </Spinner>
      </div>
    );
  }

  const deployments = data?.unifiedDeployments ?? [];
  const pendingOrRunning = pendingOrRunningData?.unifiedDeployments ?? [];
  const liveId = latestLiveData?.unifiedDeployments[0]?.id ?? '';

  if (!deployments.length) {
    return (
      <div className="flex items-center gap-3 rounded-lg border px-4 py-5 shadow-sm">
        <RocketIcon className="h-5 w-5 shrink-0" />
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="font-medium">No deployments yet</span>
          <span className="text-muted-foreground text-sm">
            We&apos;ll deploy automatically when you push to your deployment
            branch
          </span>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border">
      {deployments.map((item, index) => (
        <DeploymentListItem
          key={item.id}
          deployment={item}
          isLive={item.id === liveId}
          showRedeploy={index === 0}
          disableRedeploy={pendingOrRunning.length > 0}
        />
      ))}
    </ul>
  );
}

export default function OverviewDeployments() {
  const { project, loading } = useProject();
  const { openGitHubModal } = useGitHubModal();
  const isGitHubConnected = !!project?.githubRepository;

  if (loading) {
    return (
      <Spinner size="xs" wrapperClassName="flex-row gap-1.5">
        <span className="text-muted-foreground text-xs">
          Loading project info...
        </span>
      </Spinner>
    );
  }

  if (isGitHubConnected) {
    return (
      <section className="flex flex-col">
        <OverviewDeploymentsTopBar />
        <OverviewDeploymentList />
      </section>
    );
  }

  return (
    <section className="flex flex-col">
      <OverviewDeploymentsTopBar />

      <div className="flex flex-col gap-3 rounded-lg border px-4 py-5 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="font-medium">No deployments yet</span>
          <span className="text-muted-foreground text-sm">
            Connect a GitHub repository to deploy on every push
          </span>
        </div>
        <Button variant="outline" className="gap-2" onClick={openGitHubModal}>
          <GitHubIcon />
          Connect GitHub
        </Button>
      </div>
    </section>
  );
}
