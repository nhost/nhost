import { EditRepositorySettings } from '@/components/applications/github/EditRepositorySettings';
import useGitHubModal from '@/components/applications/github/useGitHubModal';
import { useDialog } from '@/components/common/DialogProvider';
import NavLink from '@/components/common/NavLink';
import DeploymentListItem from '@/components/deployments/DeploymentListItem';
import GithubIcon from '@/components/icons/GithubIcon';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import RocketIcon from '@/ui/v2/icons/RocketIcon';
import List from '@/ui/v2/List';
import Text from '@/ui/v2/Text';
import { getLastLiveDeployment } from '@/utils/helpers';
import {
  useGetDeploymentsSubSubscription,
  useScheduledOrPendingDeploymentsSubSubscription,
} from '@/utils/__generated__/graphql';
import { ChevronRightIcon } from '@heroicons/react/solid';
import { twMerge } from 'tailwind-merge';

function OverviewDeploymentsTopBar() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  const { githubRepository } = currentApplication;

  return (
    <div className="flex flex-row place-content-between pb-6">
      <Text
        variant="h3"
        className="self-center align-middle font-medium text-greyscaleDark"
      >
        Deployments
      </Text>
      <NavLink
        href={
          !githubRepository
            ? `#`
            : `/${currentWorkspace.slug}/${currentApplication.slug}/deployments`
        }
        className={twMerge(
          'cursor-pointer self-center align-middle font-medium text-blue',
          !githubRepository && 'cursor-not-allowed text-greyscaleGrey',
        )}
      >
        View all
        <ChevronRightIcon className="ml-1 inline-block h-4 w-4" />
      </NavLink>
    </div>
  );
}

interface OverviewDeploymentsProps {
  projectId: string;
  githubRepository: { fullName: string };
}

function OverviewDeployments({
  projectId,
  githubRepository,
}: OverviewDeploymentsProps) {
  const { openAlertDialog } = useDialog();
  const { openGitHubModal } = useGitHubModal();
  const { data, loading } = useGetDeploymentsSubSubscription({
    variables: {
      id: projectId,
      limit: 5,
      offset: 0,
    },
  });

  const {
    data: scheduledOrPendingDeploymentsData,
    loading: scheduledOrPendingDeploymentsLoading,
  } = useScheduledOrPendingDeploymentsSubSubscription({
    variables: {
      appId: projectId,
    },
  });

  if (loading || scheduledOrPendingDeploymentsLoading) {
    return (
      <div className="h-60">
        <ActivityIndicator label="Loading deployments..." />
      </div>
    );
  }

  const { deployments } = data;

  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border border-veryLightGray py-12 px-48 shadow-sm">
        <RocketIcon strokeWidth={1} className="h-10 w-10 text-greyscaleDark" />
        <div className="flex flex-col space-y-1">
          <Text className="text-center font-medium" variant="h3">
            No Deployments
          </Text>
          <Text variant="subtitle1" className="text-center">
            We&apos;ll deploy changes automatically when you push to the
            deployment branch in your connected GitHub repository
          </Text>
        </div>
        <div className="mt-6 flex h-[46px] w-[372px] flex-row place-content-between rounded-lg bg-card p-3">
          <div className="flex flex-row">
            <GithubIcon className="mr-1.5 h-4 w-4 self-center text-black" />
            <Text
              variant="body1"
              className="self-center font-normal text-black"
            >
              {githubRepository.fullName}
            </Text>
          </div>
          <Button
            variant="borderless"
            aria-label="Edit Repository Settings"
            onClick={() => {
              openAlertDialog({
                title: 'Edit Repository Settings',
                payload: (
                  <EditRepositorySettings
                    handleSelectAnotherRepository={openGitHubModal}
                  />
                ),
                props: {
                  hidePrimaryAction: true,
                  hideSecondaryAction: true,
                  hideTitle: true,
                },
              });
            }}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  }

  const liveDeploymentId = getLastLiveDeployment(deployments);
  const { deployments: scheduledOrPendingDeployments } =
    scheduledOrPendingDeploymentsData;

  return (
    <List className="rounded-x-lg flex flex-col divide-y-1 divide-gray-200 rounded-lg border border-veryLightGray">
      {deployments.map((deployment, index) => (
        <DeploymentListItem
          key={deployment.id}
          deployment={deployment}
          isLive={deployment.id === liveDeploymentId}
          showRedeploy={index === 0}
          disableRedeploy={scheduledOrPendingDeployments.length > 0}
        />
      ))}
    </List>
  );
}

export default function OverviewDeploymentsPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openGitHubModal } = useGitHubModal();

  const { githubRepository } = currentApplication;

  // GitHub repo connected. Show deployments
  if (githubRepository) {
    return (
      <div className="flex flex-col">
        <OverviewDeploymentsTopBar />
        <OverviewDeployments
          projectId={currentApplication.id}
          githubRepository={githubRepository}
        />
      </div>
    );
  }

  // No GitHub repo connected
  return (
    <div className="flex flex-col">
      <OverviewDeploymentsTopBar />
      <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border border-veryLightGray py-12 px-48 shadow-sm">
        <RocketIcon strokeWidth={1} className="h-10 w-10 text-greyscaleDark" />
        <div className="flex flex-col space-y-1">
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
            aria-label="Connect a GitHub Repository to the project"
            onClick={openGitHubModal}
          >
            <GithubIcon className="mr-1.5 h-4 w-4 self-center text-white" />
            Connect to GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}
