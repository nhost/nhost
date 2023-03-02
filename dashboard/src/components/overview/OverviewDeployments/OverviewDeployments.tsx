import useGitHubModal from '@/components/applications/github/useGitHubModal';
import DeploymentListItem from '@/components/deployments/DeploymentListItem';
import GithubIcon from '@/components/icons/GithubIcon';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import ChevronRightIcon from '@/ui/v2/icons/ChevronRightIcon';
import RocketIcon from '@/ui/v2/icons/RocketIcon';
import List from '@/ui/v2/List';
import Text from '@/ui/v2/Text';
import { getLastLiveDeployment } from '@/utils/helpers';
import {
  useGetDeploymentsSubSubscription,
  useScheduledOrPendingDeploymentsSubSubscription,
} from '@/utils/__generated__/graphql';
import NavLink from 'next/link';
import { Fragment } from 'react';

function OverviewDeploymentsTopBar() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  const { githubRepository } = currentApplication || {};

  return (
    <div className="grid grid-flow-col place-content-between items-center gap-2 pb-4">
      <Text variant="h3" className="font-medium">
        Deployments
      </Text>

      <NavLink
        href={`/${currentWorkspace?.slug}/${currentApplication?.slug}/deployments`}
        passHref
      >
        <Button variant="borderless" disabled={!githubRepository}>
          View all
          <ChevronRightIcon className="ml-1 inline-block h-4 w-4" />
        </Button>
      </NavLink>
    </div>
  );
}

function OverviewDeploymentList() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const { data, loading } = useGetDeploymentsSubSubscription({
    variables: {
      id: currentApplication?.id,
      limit: 5,
      offset: 0,
    },
  });

  const {
    data: scheduledOrPendingDeploymentsData,
    loading: scheduledOrPendingDeploymentsLoading,
  } = useScheduledOrPendingDeploymentsSubSubscription({
    variables: {
      appId: currentApplication?.id,
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
      <Box className="grid grid-flow-row items-center justify-items-center gap-5 overflow-hidden rounded-lg border-1 py-12 px-48 shadow-sm">
        <RocketIcon
          strokeWidth={1}
          className="h-10 w-10"
          sx={{ color: 'text.primary' }}
        />
        <div className="grid grid-flow-row gap-2">
          <Text className="text-center font-medium" variant="h3">
            No Deployments
          </Text>
          <Text variant="subtitle1" className="text-center">
            We&apos;ll deploy changes automatically when you push to the
            deployment branch in your connected GitHub repository
          </Text>
        </div>

        <Box
          className="mt-6 flex w-full max-w-sm flex-row place-content-between rounded-lg py-2 px-2"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <Box
            className="ml-2 grid grid-flow-col gap-1.5"
            sx={{ backgroundColor: 'transparent' }}
          >
            <GithubIcon className="h-4 w-4 self-center" />
            <Text variant="body1" className="self-center font-normal">
              {currentApplication?.githubRepository?.fullName}
            </Text>
          </Box>

          <NavLink
            href={`/${currentWorkspace.slug}/${currentApplication.slug}/settings/git`}
            passHref
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
            disableRedeploy={scheduledOrPendingDeployments?.length > 0}
          />

          {index !== deployments.length - 1 && <Divider component="li" />}
        </Fragment>
      ))}
    </List>
  );
}

export default function OverviewDeployments() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openGitHubModal } = useGitHubModal();
  const { maintenanceActive } = useUI();

  const { githubRepository } = currentApplication || {};

  // GitHub repo connected. Show deployments
  if (githubRepository) {
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

      <Box className="grid grid-flow-row items-center justify-items-center gap-5 rounded-lg border-1 py-12 px-48 shadow-sm">
        <RocketIcon strokeWidth={1} className="h-10 w-10" />

        <div className="grid grid-flow-row gap-1">
          <Text className="text-center font-medium" variant="h3">
            No Deployments
          </Text>
          <Text variant="subtitle1" className="text-center">
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
            <GithubIcon className="mr-1.5 h-4 w-4 self-center" />
            Connect to GitHub
          </Button>
        </div>
      </Box>
    </div>
  );
}
