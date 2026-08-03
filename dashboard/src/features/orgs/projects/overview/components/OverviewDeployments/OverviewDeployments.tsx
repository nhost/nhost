import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { ChevronRightIcon, RocketIcon } from 'lucide-react';
import { NavLink } from '@/components/common/NavLink';
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

      <NavLink
        href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments`}
        disabled={!isGitHubConnected}
        variant="ghost"
        className="text-primary"
        underline="none"
      >
        View all
        <ChevronRightIcon className="ml-1 inline-block h-4 w-4" />
      </NavLink>
    </div>
  );
}

function OverviewDeploymentList() {
  const { org } = useCurrentOrg();
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
      <div className="h-[323px] rounded-lg border p-2">
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
      <div className="grid grid-flow-row items-center justify-items-center gap-5 overflow-hidden rounded-lg border px-4 py-12 shadow-sm">
        <RocketIcon strokeWidth={1} className="h-10 w-10 text-foreground" />
        <div className="grid grid-flow-row gap-2">
          <h3 className="text-center font-semibold text-lg">No Deployments</h3>
          <p className="max-w-md text-center text-muted-foreground">
            We&apos;ll deploy changes automatically when you push to the
            deployment branch in your connected GitHub repository
          </p>
        </div>
        <div className="mt-6 flex w-full max-w-sm flex-row place-content-between rounded-lg bg-muted px-2 py-2">
          <div className="ml-2 grid grid-flow-col gap-1.5">
            <GitHubIcon className="h-4 w-4 self-center" />
            <span className="self-center font-normal">
              {project?.githubRepository?.fullName}
            </span>
          </div>

          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/deployments`}
            variant="ghost"
            className="text-primary"
            underline="none"
          >
            Edit
          </NavLink>
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

      <div className="grid grid-flow-row items-center justify-items-center gap-5 rounded-lg border px-4 py-12 shadow-sm">
        <RocketIcon strokeWidth={1} className="h-10 w-10" />

        <div className="grid grid-flow-row gap-1">
          <h3 className="text-center font-semibold text-lg">No Deployments</h3>
          <p className="max-w-sm text-center text-muted-foreground">
            Connect your project with a GitHub repository to create your first
            deployment
          </p>
        </div>

        <div className="flex flex-row place-content-between rounded-lg lg:w-[230px]">
          <Button className="w-full" onClick={openGitHubModal}>
            <GitHubIcon className="mr-1.5 h-4 w-4 self-center" />
            Connect to GitHub
          </Button>
        </div>
      </div>
    </section>
  );
}
