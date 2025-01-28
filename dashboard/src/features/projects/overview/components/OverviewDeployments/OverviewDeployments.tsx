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
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { DeploymentListItem } from '@/features/projects/deployments/components/DeploymentListItem';
import { useGitHubModal } from '@/features/projects/git/common/hooks/useGitHubModal';
import {
  useGetDeploymentsSubSubscription,
  useScheduledOrPendingDeploymentsSubSubscription,
} from '@/utils/__generated__/graphql';
import { getLastLiveDeployment } from '@/utils/helpers';
import NavLink from 'next/link';
import { Fragment } from 'react';

function OverviewDeploymentsTopBar() {
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const isGitHubConnected = !!currentProject?.githubRepository;

  return (
    <div className="grid grid-flow-col place-content-between items-center gap-2 pb-4">
      <Text variant="h3" className="font-medium">
        Deployments
      </Text>

      <NavLink
        href={`/${currentWorkspace?.slug}/${currentProject?.slug}/deployments`}
        passHref
        legacyBehavior
      >
        <Button variant="borderless" disabled={!isGitHubConnected}>
          View all
          <ChevronRightIcon className="ml-1 inline-block h-4 w-4" />
        </Button>
      </NavLink>
    </div>
  );
}

function OverviewDeploymentList() {
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const { data, loading } = useGetDeploymentsSubSubscription({
    variables: {
      id: currentProject?.id,
      limit: 5,
      offset: 0,
    },
  });

  const {
    data: scheduledOrPendingDeploymentsData,
    loading: scheduledOrPendingDeploymentsLoading,
  } = useScheduledOrPendingDeploymentsSubSubscription({
    variables: {
      appId: currentProject?.id,
    },
  });

  if (loading || scheduledOrPendingDeploymentsLoading) {
    return (
      <Box className="h-[323px] rounded-lg border-1 p-2">
        <ActivityIndicator label="Loading deployments..." />
      </Box>
    );
  }

  const { deployments } = data || { deployments: [] };

  if (!deployments?.length) {
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
              {currentProject?.githubRepository?.fullName}
            </Text>
          </Box>

          <NavLink
            href={`/${currentWorkspace.slug}/${currentProject.slug}/settings/git`}
            passHref
            legacyBehavior
          >
            <Button variant="borderless" size="small">
              Edit
            </Button>
          </NavLink>
        </Box>
      </Box>
    );
  }

  const liveDeploymentId = getLastLiveDeployment(deployments);
  const { deployments: scheduledOrPendingDeployments } =
    scheduledOrPendingDeploymentsData || { deployments: [] };
  const isDeploymentInProgress = deployments?.some((deployment) =>
    ['PENDING', 'SCHEDULED'].includes(deployment.deploymentStatus),
  );

  return (
    <List
      className="rounded-x-lg flex flex-col overflow-hidden rounded-lg"
      sx={{ borderColor: 'grey.300', borderWidth: 1 }}
    >
      {deployments?.map((deployment, index) => (
        <Fragment key={deployment.id}>
          <DeploymentListItem
            deployment={deployment}
            isLive={deployment.id === liveDeploymentId}
            showRedeploy={index === 0}
            disableRedeploy={
              scheduledOrPendingDeployments?.length > 0 ||
              isDeploymentInProgress
            }
          />

          {index !== deployments.length - 1 && <Divider component="li" />}
        </Fragment>
      ))}
    </List>
  );
}

export default function OverviewDeployments() {
  const { currentProject, loading } = useCurrentWorkspaceAndProject();
  const { openGitHubModal } = useGitHubModal();
  const { maintenanceActive } = useUI();
  const isGitHubConnected = !!currentProject?.githubRepository;

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
