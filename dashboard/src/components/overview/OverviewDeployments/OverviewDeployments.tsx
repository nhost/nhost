import { AppDeploymentDuration } from '@/components/applications/AppDeployments';
import { EditRepositorySettings } from '@/components/applications/github/EditRepositorySettings';
import useGitHubModal from '@/components/applications/github/useGitHubModal';
import { useDialog } from '@/components/common/DialogProvider';
import NavLink from '@/components/common/NavLink';
import GithubIcon from '@/components/icons/GithubIcon';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import Status, { StatusEnum } from '@/ui/Status';
import type { DeploymentStatus } from '@/ui/StatusCircle';
import { StatusCircle } from '@/ui/StatusCircle';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import RocketIcon from '@/ui/v2/icons/RocketIcon';
import type { ListItemRootProps } from '@/ui/v2/ListItem';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { getLastLiveDeployment } from '@/utils/helpers';
import type { DeploymentRowFragment } from '@/utils/__generated__/graphql';
import { useGetDeploymentsSubSubscription } from '@/utils/__generated__/graphql';
import { ChevronRightIcon } from '@heroicons/react/solid';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
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

interface OverviewDeployProps extends ListItemRootProps {
  /**
   * Deployment metadata to display.
   */
  deployment: DeploymentRowFragment;
  /**
   * Determines to show a status badge showing the live status of a deployment reflecting the latest state of the application.
   */
  isDeploymentLive: boolean;
}

function OverviewDeployment({
  deployment,
  isDeploymentLive,
  className,
}: OverviewDeployProps) {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  const relativeDateOfDeployment = formatDistanceToNowStrict(
    parseISO(deployment.deploymentStartedAt),
    {
      addSuffix: true,
    },
  );

  const { commitMessage } = deployment;

  return (
    <ListItem.Root className={twMerge('grid grid-flow-row', className)}>
      <ListItem.Button
        className="grid grid-flow-col items-center justify-between gap-2 px-2 py-2"
        component={NavLink}
        href={`/${currentWorkspace.slug}/${currentApplication.slug}/deployments/${deployment.id}`}
      >
        <div className="flex cursor-pointer flex-row items-center justify-center space-x-2 self-center">
          <div>
            <Avatar
              name={deployment.commitUserName}
              avatarUrl={deployment.commitUserAvatarUrl}
              className="h-8 w-8"
            />
          </div>
          <div className="grid grid-flow-row truncate text-sm+ font-medium">
            <Text className="inline cursor-pointer truncate font-medium leading-snug text-greyscaleDark">
              {commitMessage?.trim() || (
                <span className="truncate pr-1 font-normal italic">
                  No commit message
                </span>
              )}
            </Text>
            <Text className="text-sm font-normal leading-[1.375rem] text-greyscaleGrey">
              {relativeDateOfDeployment}
            </Text>
          </div>
        </div>
        <div className="grid grid-flow-col items-center self-center">
          {isDeploymentLive && (
            <div className="flex self-center align-middle">
              <Status status={StatusEnum.Live}>Live</Status>
            </div>
          )}

          <div className="w-20 self-center text-right align-middle font-mono text-sm- font-medium">
            {deployment.commitSHA.substring(0, 7)}
          </div>
          <div className="w-20 self-center text-right align-middle font-mono text-sm-">
            <AppDeploymentDuration
              startedAt={deployment.deploymentStartedAt}
              endedAt={deployment.deploymentEndedAt}
            />
          </div>
          <div className="mx-3 self-center">
            <StatusCircle
              status={deployment.deploymentStatus as DeploymentStatus}
            />
          </div>
          <div className="self-center">
            <ChevronRightIcon className="ml-2 h-4 w-4 cursor-pointer self-center" />
          </div>
        </div>
      </ListItem.Button>
    </ListItem.Root>
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

  if (loading) {
    return (
      <div style={{ height: '240px' }}>
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

  const getLastLiveDeploymentId = getLastLiveDeployment(deployments);

  return (
    <div className="rounded-x-lg flex flex-col divide-y-1 divide-gray-200 rounded-lg border border-veryLightGray">
      {deployments.map((deployment) => {
        const isDeploymentLive = deployment.id === getLastLiveDeploymentId;

        return (
          <OverviewDeployment
            key={deployment.id}
            deployment={deployment}
            isDeploymentLive={isDeploymentLive}
          />
        );
      })}
    </div>
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
