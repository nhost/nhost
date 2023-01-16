import { useDialog } from '@/components/common/DialogProvider';
import type { GithubRepositoryFragment } from '@/generated/graphql';
import {
  refetchGetAppByWorkspaceAndNameQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui';
import { Text } from '@/ui/Text';
import Button from '@/ui/v2/Button';
import { triggerToast } from '@/utils/toast';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useApolloClient } from '@apollo/client';
import clsx from 'clsx';
import { EditRepositorySettings } from './EditRepositorySettings';
// ConnectGitHubModal and EditRepositorySettings form a dependency cycle which
// needs to be fixed
// eslint-disable-next-line import/no-cycle
import useGitHubModal from './useGitHubModal';

interface RepoProps {
  repo?: GithubRepositoryFragment;

  setSelectedRepoId?: () => void;
}

export function Repo({ repo, setSelectedRepoId }: RepoProps) {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const client = useApolloClient();
  const { openAlertDialog } = useDialog();
  const { openGitHubModal } = useGitHubModal();

  const [updateApp, { loading, error }] = useUpdateAppMutation({
    refetchQueries: [
      refetchGetAppByWorkspaceAndNameQuery({
        workspace: currentWorkspace?.slug,
        slug: currentApplication?.slug,
      }),
    ],
  });

  const { githubRepository } = currentApplication || {};

  const isThisRepositoryAlreadyConnected =
    githubRepository?.fullName && githubRepository.fullName === repo.fullName;

  const handleRepoClick = async () => {
    setSelectedRepoId();
  };

  const disconnectRepo = async () => {
    await updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          githubRepositoryId: null,
        },
      },
    });
    triggerToast(
      `Succesfully disconnected GitHub repository from ${currentApplication.name}.`,
    );
    await updateOwnCache(client);
  };

  const openCurrentRepoSettings = () => {
    openAlertDialog({
      title: 'Edit Repository Settings',
      payload: (
        <EditRepositorySettings
          handleSelectAnotherRepository={openGitHubModal}
        />
      ),
      props: {
        hideTitle: true,
        hidePrimaryAction: true,
        hideSecondaryAction: true,
      },
    });
  };

  if (error) {
    throw error;
  }

  return (
    <div className="flex w-full flex-row place-content-between py-4 px-1">
      <div className="flex flex-row">
        <Avatar
          name={repo.githubAppInstallation.accountLogin}
          avatarUrl={repo.githubAppInstallation.accountAvatarUrl}
          className="h-8 w-8 self-center"
        />
        <div className="ml-2 flex flex-col">
          <Text
            color="greyscaleDark"
            className={clsx(
              'w-label self-center font-medium',
              isThisRepositoryAlreadyConnected && 'cursor-pointer',
            )}
            size="normal"
            onClick={
              !isThisRepositoryAlreadyConnected
                ? () => null
                : openCurrentRepoSettings
            }
          >
            {repo.name}
          </Text>
          <Text color="greyscaleDark" className="" size="tiny">
            {repo.githubAppInstallation.accountLogin}
          </Text>
        </div>
      </div>
      {!isThisRepositoryAlreadyConnected ? (
        <Button
          variant="borderless"
          color="primary"
          loading={loading}
          onClick={() => handleRepoClick()}
        >
          Connect
        </Button>
      ) : (
        <Button
          variant="borderless"
          color="error"
          loading={loading}
          onClick={() => disconnectRepo()}
        >
          Disconnect
        </Button>
      )}
    </div>
  );
}

export default Repo;
