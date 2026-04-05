import { Fragment, useMemo } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { useUI } from '@/components/common/UIProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { ChevronRightIcon } from '@/components/ui/v2/icons/ChevronRightIcon';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { RocketIcon } from '@/components/ui/v2/icons/RocketIcon';
import { List } from '@/components/ui/v2/List';
import { Text } from '@/components/ui/v2/Text';
import { DeploymentListItem } from '@/features/orgs/projects/deployments/components/DeploymentListItem';
import { legacyDeploymentToListItem } from '@/features/orgs/projects/deployments/utils/legacy-deployments';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetDeploymentsQuery,
  useGetPipelineRunsSubSubscription,
  usePendingOrRunningPipelineRunsSubSubscription,
} from '@/utils/__generated__/graphql';
import { getLastSucceededPipelineRun } from '@/utils/helpers';

function OverviewDeploymentsTopBar() {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  const isGitHubConnected = !!project?.githubRepository;

  return (
    <div className="grid grid-flow-col place-content-between items-center gap-2 pb-4">
      <Text variant="h3" className="font-medium">
        Deployments
      </Text>

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

  const { data, loading } = useGetPipelineRunsSubSubscription({
    variables: {
      id: project?.id,
      limit: 5,
      offset: 0,
    },
  });

  const { data: pendingOrRunningData, loading: pendingOrRunningLoading } =
    usePendingOrRunningPipelineRunsSubSubscription({
      variables: {
        appId: project?.id,
      },
    });

  // Legacy deployments (deprecated, read-only)
  const { data: legacyDeploymentsData, loading: legacyDeploymentsLoading } =
    useGetDeploymentsQuery({
      variables: {
        id: project?.id,
        limit: 5,
        offset: 0,
      },
    });

  const pipelineRuns = data?.pipelineRuns ?? [];
  const legacyDeployments = legacyDeploymentsData?.deployments ?? [];
  const convertedLegacy = legacyDeployments.map(legacyDeploymentToListItem);

  const allItems = useMemo(() => {
    const merged = [...pipelineRuns, ...convertedLegacy];
    merged.sort((a, b) => {
      const dateA = new Date(a.startedAt ?? a.createdAt).getTime();
      const dateB = new Date(b.startedAt ?? b.createdAt).getTime();
      return dateB - dateA;
    });
    return merged.slice(0, 5);
  }, [pipelineRuns, convertedLegacy]);

  if (loading || pendingOrRunningLoading || legacyDeploymentsLoading) {
    return (
      <Box className="h-[323px] rounded-lg border-1 p-2">
        <ActivityIndicator label="Loading deployments..." />
      </Box>
    );
  }

  if (!allItems.length) {
    return (
      <Box className="grid grid-flow-row items-center justify-items-center gap-5 overflow-hidden rounded-lg border-1 px-4 py-12 shadow-sm">
        <RocketIcon
          strokeWidth={1}
          className="h-10 w-10"
          sx={{ color: 'text.primary' }}
        />
        <div className="grid grid-flow-row gap-2">
          <Text className="text-center font-medium" variant="h3">
            No Deployments
          </Text>
          <Text variant="subtitle1" className="max-w-md text-center">
            We&apos;ll deploy changes automatically when you push to the
            deployment branch in your connected GitHub repository
          </Text>
        </div>

        <Box
          className="mt-6 flex w-full max-w-sm flex-row place-content-between rounded-lg px-2 py-2"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <Box
            className="ml-2 grid grid-flow-col gap-1.5"
            sx={{ backgroundColor: 'transparent' }}
          >
            <GitHubIcon className="h-4 w-4 self-center" />
            <Text variant="body1" className="self-center font-normal">
              {project?.githubRepository?.fullName}
            </Text>
          </Box>

          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/git`}
            variant="ghost"
            className="text-primary"
            underline="none"
          >
            Edit
          </NavLink>
        </Box>
      </Box>
    );
  }

  const liveRunId = getLastSucceededPipelineRun(pipelineRuns);
  const pendingOrRunningRuns = pendingOrRunningData?.pipelineRuns ?? [];
  const isInProgress = pipelineRuns.some((run) =>
    ['pending', 'running'].includes(run.status as string),
  );

  return (
    <List
      className="flex flex-col overflow-hidden rounded-lg rounded-x-lg"
      sx={{ borderColor: 'grey.300', borderWidth: 1 }}
    >
      {allItems.map((item, index) => {
        const isLegacy = item.name === 'legacy-deployment';
        return (
          <Fragment key={item.id}>
            <DeploymentListItem
              pipelineRun={item}
              isLive={item.id === liveRunId}
              showRedeploy={!isLegacy && index === 0}
              disableRedeploy={pendingOrRunningRuns.length > 0 || isInProgress}
            />

            {index !== allItems.length - 1 && <Divider component="li" />}
          </Fragment>
        );
      })}
    </List>
  );
}

export default function OverviewDeployments() {
  const { project, loading } = useProject();
  const { openGitHubModal } = useGitHubModal();
  const { maintenanceActive } = useUI();
  const isGitHubConnected = !!project?.githubRepository;

  if (loading) {
    return <ActivityIndicator label="Loading project info..." delay={1000} />;
  }

  // GitHub repo connected. Show deployments
  if (isGitHubConnected) {
    return (
      <div className="flex flex-col">
        <OverviewDeploymentsTopBar />
        <OverviewDeploymentList />
      </div>
    );
  }

  // No GitHub repo connected
  return (
    <div className="flex flex-col">
      <OverviewDeploymentsTopBar />

      <Box className="grid grid-flow-row items-center justify-items-center gap-5 rounded-lg border-1 px-4 py-12 shadow-sm">
        <RocketIcon strokeWidth={1} className="h-10 w-10" />

        <div className="grid grid-flow-row gap-1">
          <Text className="text-center font-medium" variant="h3">
            No Deployments
          </Text>
          <Text variant="subtitle1" className="max-w-sm text-center">
            Connect your project with a GitHub repository to create your first
            deployment
          </Text>
        </div>

        <div className="flex flex-row place-content-between rounded-lg lg:w-[230px]">
          <Button
            variant="contained"
            color="primary"
            className="w-full"
            onClick={openGitHubModal}
            disabled={maintenanceActive}
          >
            <GitHubIcon className="mr-1.5 h-4 w-4 self-center" />
            Connect to GitHub
          </Button>
        </div>
      </Box>
    </div>
  );
}
